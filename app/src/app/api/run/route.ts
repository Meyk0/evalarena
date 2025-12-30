import { NextResponse } from "next/server";
import { callOpenAI } from "@/lib/openai";
import { buildJudgeFailure, parseJudgeOutput } from "@/lib/judge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createBrowserClient } from "@/lib/supabase/browser";
import { evaluateTraces, parseRules } from "@/lib/rules";
import type { RunResponse, Trace } from "@/lib/types";

type RunRequest = {
  challenge_id: string;
  active_tab: "rules" | "judge";
  eval_config: string;
  target_set: "dev" | "test";
};

type ChallengeRow = {
  id: string;
  pass_threshold: number | null;
  context_json: {
    system_prompt?: string;
    tools?: unknown[];
    contract?: string[];
  } | null;
};

type TraceRow = {
  id: string;
  messages_json: Trace["messages"] | null;
};

function redactText(text: string) {
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (!/[A-Za-z0-9]/.test(token)) {
        return token;
      }
      if (token.length <= 2) {
        return "*".repeat(token.length);
      }
      return `${token[0]}${"*".repeat(token.length - 2)}${token[token.length - 1]}`;
    })
    .join("");
}

function buildSummary(
  total: number,
  failCount: number,
  criticalCount: number,
  passThreshold: number
) {
  const passRate = total === 0 ? 0 : (total - failCount) / total;

  return {
    passRate,
    criticalCount,
    ship: passRate >= passThreshold && criticalCount === 0,
  };
}

function buildRedactedReport(
  evaluations: ReturnType<typeof evaluateTraces>,
  traces: Trace[]
) {
  const traceMap = new Map(traces.map((trace) => [trace.id, trace]));

  return evaluations
    .filter((evaluation) => evaluation.failures.length > 0)
    .map((evaluation) => {
      const failure = evaluation.failures[0];
      const trace = traceMap.get(evaluation.traceId);
      const matchedMessage =
        trace?.messages[failure.matchIndex]?.content ?? failure.detail;

      return {
        traceId: evaluation.traceId,
        cluster: failure.rule.id,
        contract_clause:
          failure.rule.notes ?? "A contract clause was violated.",
        redacted_evidence: redactText(matchedMessage),
      };
    });
}

function buildReportFromResults(
  results: RunResponse["results"],
  traces: Trace[]
) {
  const traceMap = new Map(traces.map((trace) => [trace.id, trace]));

  return results
    .filter((result) => result.status === "fail")
    .map((result) => {
      const trace = traceMap.get(result.traceId);
      const evidenceDetail = result.evidence?.[0]?.detail ?? result.reasoning;
      const evidence =
        evidenceDetail ??
        trace?.messages.find((message) => message.role === "assistant")?.content ??
        "Failure detected.";

      return {
        traceId: result.traceId,
        cluster: result.cluster,
        contract_clause: "A contract clause was violated.",
        redacted_evidence: redactText(evidence),
      };
    });
}

function formatTrace(trace: Trace) {
  return trace.messages
    .map((message, index) => {
      const base = `${index}. ${message.role.toUpperCase()}: ${message.content}`;
      if (message.metadata) {
        return `${base}\n   metadata: ${JSON.stringify(message.metadata)}`;
      }
      return base;
    })
    .join("\n");
}

async function judgeTrace({
  apiKey,
  model,
  rubric,
  trace,
  context,
}: {
  apiKey: string;
  model: string;
  rubric: string;
  trace: Trace;
  context: ChallengeRow["context_json"];
}) {
  const contract = context?.contract ?? [];
  const systemPrompt = context?.system_prompt ?? "";
  const tools = context?.tools ?? [];

  const { content } = await callOpenAI(
    apiKey,
    [
      {
        role: "system",
        content:
          "You are a strict evaluation judge. Output JSON only. Schema: {\"pass\": boolean, \"severity\": \"low\"|\"high\"|\"critical\", \"cluster\": string, \"reason\": string, \"evidence\": [{\"idx\": number, \"label\": string, \"detail\": string}]}.",
      },
      {
        role: "user",
        content: `Contract clauses:\\n${contract.map((clause) => `- ${clause}`).join("\\n") || "(none)"}\\n\\nSystem prompt:\\n${systemPrompt || "(none)"}\\n\\nTool manifest:\\n${JSON.stringify(tools, null, 2)}\\n\\nEval rubric:\\n${rubric}\\n\\nTrace transcript:\\n${formatTrace(trace)}\\n\\nReturn only JSON.`,
      },
    ],
    model,
    0
  );

  const parsed = parseJudgeOutput(content);
  if (!parsed.output) {
    return buildJudgeFailure(trace.id, parsed.error || "Invalid judge output.");
  }

  const output = parsed.output;
  return {
    traceId: trace.id,
    status: output.pass ? "pass" : "fail",
    severity: output.severity,
    cluster: output.cluster,
    evidence:
      output.evidence?.map((item) => ({
        ...item,
        level: output.pass ? "warn" : "bad",
      })) ?? [],
    reasoning: output.reason,
  };
}

async function runMetaJudge({
  apiKey,
  model,
  rubric,
  context,
}: {
  apiKey: string;
  model: string;
  rubric: string;
  context: ChallengeRow["context_json"];
}) {
  const contract = context?.contract ?? [];
  const { content } = await callOpenAI(
    apiKey,
    [
      {
        role: "system",
        content:
          "You critique eval rubrics for clarity, coverage, and evidence requirements. Provide a short critique with concrete gaps.",
      },
      {
        role: "user",
        content: `Contract clauses:\\n${contract.map((clause) => `- ${clause}`).join("\\n") || "(none)"}\\n\\nRubric:\\n${rubric}\\n\\nWrite 3-5 sentences. Be specific about missing criteria, vague language, or lack of evidence requirements.`,
      },
    ],
    model,
    0.2
  );

  return content.trim();
}

export async function POST(request: Request) {
  let body: RunRequest;

  try {
    body = (await request.json()) as RunRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (
    !body?.challenge_id ||
    (body.active_tab !== "rules" && body.active_tab !== "judge") ||
    (body.target_set !== "dev" && body.target_set !== "test") ||
    typeof body.eval_config !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid parameters." },
      { status: 400 }
    );
  }

  const supabase =
    body.target_set === "test" ? supabaseAdmin : createBrowserClient();

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, pass_threshold, context_json")
    .eq("id", body.challenge_id)
    .single();

  if (challengeError || !challenge) {
    return NextResponse.json(
      { error: "Challenge not found." },
      { status: 404 }
    );
  }

  const { data: traces, error: traceError } = await supabase
    .from("traces")
    .select("id, messages_json")
    .eq("challenge_id", body.challenge_id)
    .eq("set_type", body.target_set)
    .order("id", { ascending: true });

  if (traceError || !traces) {
    return NextResponse.json(
      { error: "Failed to load traces." },
      { status: 500 }
    );
  }

  const passThreshold =
    (challenge as ChallengeRow).pass_threshold ?? 0.85;

  const parsedTraces = (traces as TraceRow[]).map((trace) => ({
    id: trace.id,
    messages: Array.isArray(trace.messages_json) ? trace.messages_json : [],
  }));

  if (body.active_tab === "rules") {
    let rules;
    try {
      rules = parseRules(body.eval_config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid rules.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const evaluations = evaluateTraces(rules, parsedTraces);
    const results = evaluations.map((evaluation) => evaluation.result);
    const failCount = results.filter((result) => result.status === "fail").length;
    const criticalCount = results.filter(
      (result) => result.status === "fail" && result.severity === "critical"
    ).length;

    if (body.target_set === "test") {
      const testReport = buildRedactedReport(evaluations, parsedTraces);

      const response: RunResponse = {
        results: [],
        summary: buildSummary(
          parsedTraces.length,
          failCount,
          criticalCount,
          passThreshold
        ),
        test_report: testReport,
      };

      return NextResponse.json(response);
    }

    const response: RunResponse = {
      results,
      summary: buildSummary(
        parsedTraces.length,
        failCount,
        criticalCount,
        passThreshold
      ),
    };

    return NextResponse.json(response);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY for judge mode." },
      { status: 500 }
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const challengeRow = challenge as ChallengeRow;
  const context = challengeRow.context_json ?? {
    system_prompt: "",
    tools: [],
    contract: [],
  };

  let metaCritique: string | undefined;
  try {
    metaCritique = await runMetaJudge({
      apiKey,
      model,
      rubric: body.eval_config,
      context,
    });
  } catch (error) {
    metaCritique = "Meta-judge failed to run.";
  }

  const results: RunResponse["results"] = [];
  for (const trace of parsedTraces) {
    try {
      const result = await judgeTrace({
        apiKey,
        model,
        rubric: body.eval_config,
        trace,
        context,
      });
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Judge failed.";
      results.push(buildJudgeFailure(trace.id, message));
    }
  }

  const failCount = results.filter((result) => result.status === "fail").length;
  const criticalCount = results.filter(
    (result) => result.status === "fail" && result.severity === "critical"
  ).length;

  if (body.target_set === "test") {
    const testReport = buildReportFromResults(results, parsedTraces);

    const response: RunResponse = {
      results: [],
      summary: buildSummary(
        parsedTraces.length,
        failCount,
        criticalCount,
        passThreshold
      ),
      meta_critique: metaCritique,
      test_report: testReport,
    };

    return NextResponse.json(response);
  }

  const response: RunResponse = {
    results,
    summary: buildSummary(
      parsedTraces.length,
      failCount,
      criticalCount,
      passThreshold
    ),
    meta_critique: metaCritique,
  };

  return NextResponse.json(response);
}
