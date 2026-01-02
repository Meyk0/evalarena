import { NextResponse } from "next/server";
import { callOpenAI } from "@/lib/openai";
import { buildJudgeFailure, parseJudgeOutput } from "@/lib/judge";
import { buildJudgeReportItem, redactText } from "@/lib/report";
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

const rubricStopwords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "without",
  "you",
  "your",
  "we",
  "us",
]);

function extractTokens(text: string) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9_]+/g)
      ?.filter((token) => token.length > 3 && !rubricStopwords.has(token)) ?? []
  );
}

function buildRubricCoverage(rubric: string, contract: string[]) {
  if (contract.length === 0) {
    return {
      totalClauses: 0,
      matchedClauses: [],
      missingClauses: [],
    };
  }

  const rubricLower = rubric.toLowerCase();
  const matchedClauses: string[] = [];
  const missingClauses: string[] = [];

  contract.forEach((clause) => {
    const tokens = extractTokens(clause);
    const matched =
      tokens.length === 0
        ? rubricLower.includes(clause.toLowerCase())
        : tokens.some((token) => rubricLower.includes(token));
    if (matched) {
      matchedClauses.push(clause);
    } else {
      missingClauses.push(clause);
    }
  });

  return {
    totalClauses: contract.length,
    matchedClauses,
    missingClauses,
  };
}

function buildSummary(
  total: number,
  failCount: number,
  criticalCount: number,
  passThreshold: number,
  coverageOk = true
) {
  const passRate = total === 0 ? 0 : (total - failCount) / total;

  return {
    passRate,
    criticalCount,
    ship: passRate >= passThreshold && criticalCount === 0 && coverageOk,
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
      const evidence = `msg idx ${failure.matchIndex}: ${matchedMessage}`;

      return {
        traceId: evaluation.traceId,
        cluster: failure.rule.id,
        contract_clause:
          failure.rule.notes ?? "A contract clause was violated.",
        redacted_evidence: redactText(evidence),
      };
    });
}

const judgeThrottle = new Map<string, number>();
const judgeThrottleMs = Number(process.env.JUDGE_THROTTLE_MS ?? 3000);

function getClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  return ip;
}

function checkJudgeThrottle(request: Request, key: string) {
  if (!Number.isFinite(judgeThrottleMs) || judgeThrottleMs <= 0) {
    return null;
  }

  const now = Date.now();
  const last = judgeThrottle.get(key) ?? 0;
  if (now - last < judgeThrottleMs) {
    return `Judge runs are throttled. Please wait ${Math.ceil(
      (judgeThrottleMs - (now - last)) / 1000
    )}s and try again.`;
  }

  judgeThrottle.set(key, now);

  if (judgeThrottle.size > 500) {
    for (const [entryKey, timestamp] of judgeThrottle.entries()) {
      if (now - timestamp > judgeThrottleMs * 10) {
        judgeThrottle.delete(entryKey);
      }
    }
  }

  return null;
}

function buildReportFromResults(
  results: RunResponse["results"],
  traces: Trace[],
  contract: string[]
) {
  return results
    .filter((result) => result.status === "fail")
    .map((result) =>
      buildJudgeReportItem({
        result,
        contract,
      })
    );
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
          "You are an eval coach. Critique rubrics for clarity, coverage, and evidence requirements. Be specific and actionable.",
      },
      {
        role: "user",
        content: `Contract clauses:\\n${contract.map((clause) => `- ${clause}`).join("\\n") || "(none)"}\\n\\nRubric:\\n${rubric}\\n\\nReturn 3-5 bullet points. For each bullet: name the gap and suggest the exact sentence to add. If the rubric is strong, say: "No major gaps."`,
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
    const matchMap = new Map<string, Set<string>>();
    rules.forEach((rule) => matchMap.set(rule.id, new Set()));
    evaluations.forEach((evaluation) => {
      evaluation.matchedRules.forEach((ruleId) => {
        const set = matchMap.get(ruleId);
        if (set) {
          set.add(evaluation.traceId);
        }
      });
    });
    const matchedCountsByRule = Object.fromEntries(
      rules.map((rule) => [rule.id, matchMap.get(rule.id)?.size ?? 0])
    );
    const matchedByRule =
      body.target_set === "dev"
        ? Object.fromEntries(
            rules.map((rule) => [
              rule.id,
              Array.from(matchMap.get(rule.id) ?? []),
            ])
          )
        : undefined;
    const matchedRules = rules
      .map((rule) => rule.id)
      .filter((ruleId) => (matchedCountsByRule[ruleId] ?? 0) > 0);
    const unmatchedRules = rules
      .map((rule) => rule.id)
      .filter((ruleId) => (matchedCountsByRule[ruleId] ?? 0) === 0);
    const coverage = {
      totalRules: rules.length,
      matchedRules,
      unmatchedRules,
      matchedByRule,
      matchedCountsByRule,
    };
    const coverageOk = unmatchedRules.length === 0;

    if (body.target_set === "test") {
      const testReport = buildRedactedReport(evaluations, parsedTraces);

      const response: RunResponse = {
        results: [],
        summary: buildSummary(
          parsedTraces.length,
          failCount,
          criticalCount,
          passThreshold,
          coverageOk
        ),
        test_report: testReport,
        coverage,
      };

      return NextResponse.json(response);
    }

    const response: RunResponse = {
      results,
      summary: buildSummary(
        parsedTraces.length,
        failCount,
        criticalCount,
        passThreshold,
        coverageOk
      ),
      coverage,
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
  const rubricCoverage = buildRubricCoverage(
    body.eval_config,
    context.contract ?? []
  );
  const rubricCoverageOk = rubricCoverage.missingClauses.length === 0;
  if (
    rubricCoverage.totalClauses > 0 &&
    rubricCoverage.matchedClauses.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Rubric does not reference the contract. Add contract clause terms before running.",
        rubric_coverage: rubricCoverage,
      },
      { status: 400 }
    );
  }

  const throttleKey = `${getClientKey(request)}:${body.challenge_id}:${body.target_set}`;
  const throttleError = checkJudgeThrottle(request, throttleKey);
  if (throttleError) {
    return NextResponse.json({ error: throttleError }, { status: 429 });
  }

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
    const testReport = buildReportFromResults(
      results,
      parsedTraces,
      context.contract ?? []
    );

    const response: RunResponse = {
      results: [],
      summary: buildSummary(
        parsedTraces.length,
        failCount,
        criticalCount,
        passThreshold,
        rubricCoverageOk
      ),
      meta_critique: metaCritique,
      test_report: testReport,
      rubric_coverage: rubricCoverage,
    };

    return NextResponse.json(response);
  }

  const response: RunResponse = {
    results,
    summary: buildSummary(
      parsedTraces.length,
      failCount,
      criticalCount,
      passThreshold,
      rubricCoverageOk
    ),
    meta_critique: metaCritique,
    rubric_coverage: rubricCoverage,
  };

  return NextResponse.json(response);
}
