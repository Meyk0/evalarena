import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createBrowserClient } from "@/lib/supabase/browser";
import type { RunResponse } from "@/lib/types";

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
  messages_json: unknown;
  hidden_fail_reason: string | null;
};

type HiddenFailReason = {
  cluster?: string;
  contract_clause?: string;
  evidence?: string;
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

function parseHiddenFailReason(value: string | null): HiddenFailReason | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as HiddenFailReason;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function buildTestReport(traces: TraceRow[]) {
  return traces
    .filter((trace) => trace.hidden_fail_reason)
    .map((trace) => {
      const parsed = parseHiddenFailReason(trace.hidden_fail_reason);
      const evidence = parsed?.evidence ?? trace.hidden_fail_reason ?? "";

      return {
        traceId: trace.id,
        cluster: parsed?.cluster ?? "Hidden regression",
        contract_clause:
          parsed?.contract_clause ??
          "A contract clause was violated in the hidden test set.",
        redacted_evidence: redactText(evidence),
      };
    });
}

function buildSummary(
  total: number,
  failCount: number,
  passThreshold: number
) {
  const passRate = total === 0 ? 0 : (total - failCount) / total;
  const criticalCount = 0;

  return {
    passRate,
    criticalCount,
    ship: passRate >= passThreshold && criticalCount === 0,
  };
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
    .select("id, messages_json, hidden_fail_reason")
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

  if (body.target_set === "test") {
    const testReport = buildTestReport(traces as TraceRow[]);
    const failCount = testReport.length;

    const response: RunResponse = {
      results: [],
      summary: buildSummary(traces.length, failCount, passThreshold),
      test_report: testReport,
    };

    return NextResponse.json(response);
  }

  const results = (traces as TraceRow[]).map((trace) => {
    const isFail = Boolean(trace.hidden_fail_reason);
    return {
      traceId: trace.id,
      status: isFail ? "fail" : "pass",
      severity: "low",
      cluster: isFail ? "Hidden fail" : "Pass",
      evidence: [],
    };
  });

  const failCount = results.filter((result) => result.status === "fail").length;

  const response: RunResponse = {
    results,
    summary: buildSummary(traces.length, failCount, passThreshold),
  };

  return NextResponse.json(response);
}
