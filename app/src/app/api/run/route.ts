import { NextResponse } from "next/server";
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

  if (body.active_tab === "judge") {
    return NextResponse.json(
      { error: "Judge mode is not implemented yet." },
      { status: 501 }
    );
  }

  const supabase =
    body.target_set === "test" ? supabaseAdmin : createBrowserClient();

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, pass_threshold")
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

  let rules;
  try {
    rules = parseRules(body.eval_config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid rules.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const parsedTraces = (traces as TraceRow[]).map((trace) => ({
    id: trace.id,
    messages: Array.isArray(trace.messages_json) ? trace.messages_json : [],
  }));

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
