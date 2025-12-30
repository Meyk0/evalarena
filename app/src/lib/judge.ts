import type { RunResult } from "@/lib/types";

export type JudgeOutput = {
  pass: boolean;
  severity: "low" | "high" | "critical";
  cluster: string;
  reason: string;
  evidence?: Array<{
    idx: number;
    label: string;
    detail: string;
  }>;
};

export type ParsedJudgeOutput = {
  output: JudgeOutput | null;
  error?: string;
};

const allowedSeverities = new Set(["low", "high", "critical"]);

function extractJson(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseJudgeOutput(rawContent: string): ParsedJudgeOutput {
  const jsonText = extractJson(rawContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return { output: null, error: "Invalid JSON output from judge." };
  }

  if (!isPlainObject(parsed)) {
    return { output: null, error: "Judge output must be a JSON object." };
  }

  const pass = parsed.pass;
  const severity = parsed.severity;
  const cluster = parsed.cluster;
  const reason = parsed.reason;
  const evidence = parsed.evidence;

  if (typeof pass !== "boolean") {
    return { output: null, error: "Judge output missing pass boolean." };
  }

  if (typeof severity !== "string" || !allowedSeverities.has(severity)) {
    return { output: null, error: "Judge output has invalid severity." };
  }

  if (typeof cluster !== "string" || cluster.trim() === "") {
    return { output: null, error: "Judge output missing cluster label." };
  }

  if (typeof reason !== "string" || reason.trim() === "") {
    return { output: null, error: "Judge output missing reason." };
  }

  let normalizedEvidence: JudgeOutput["evidence"] | undefined;
  if (evidence !== undefined) {
    if (!Array.isArray(evidence)) {
      return { output: null, error: "Judge output evidence must be an array." };
    }

    normalizedEvidence = evidence.map((item) => {
      if (!isPlainObject(item)) {
        throw new Error("Evidence items must be objects.");
      }
      const idx = item.idx;
      const label = item.label;
      const detail = item.detail;
      if (typeof idx !== "number") {
        throw new Error("Evidence idx must be a number.");
      }
      if (typeof label !== "string") {
        throw new Error("Evidence label must be a string.");
      }
      if (typeof detail !== "string") {
        throw new Error("Evidence detail must be a string.");
      }
      return { idx, label, detail };
    });
  }

  return {
    output: {
      pass,
      severity: severity as JudgeOutput["severity"],
      cluster: cluster.trim(),
      reason: reason.trim(),
      evidence: normalizedEvidence,
    },
  };
}

export function buildJudgeFailure(
  traceId: string,
  message: string
): RunResult {
  return {
    traceId,
    status: "fail",
    severity: "high",
    cluster: "Invalid judge response",
    evidence: [
      {
        idx: 0,
        label: "judge_error",
        detail: message,
        level: "bad",
      },
    ],
    reasoning: message,
  };
}
