import type { RunResult } from "@/lib/types";

export function redactText(text: string) {
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

export function pickContractClause(
  contract: string[],
  reason: string,
  evidence: string[]
) {
  if (contract.length === 0) {
    return "A contract clause was violated.";
  }

  const haystack = `${reason} ${evidence.join(" ")}`.toLowerCase();
  const match = contract.find((clause) =>
    haystack.includes(clause.toLowerCase())
  );

  return match ?? contract[0];
}

export function buildRedactedExcerpts(
  evidence: string[],
  fallback: string
): string[] {
  const excerpts = evidence.map((item) => item.trim()).filter(Boolean);
  if (excerpts.length === 0 && fallback.trim()) {
    excerpts.push(fallback.trim());
  }

  return excerpts.slice(0, 2).map((excerpt) => redactText(excerpt));
}

export function buildJudgeReportItem({
  result,
  contract,
}: {
  result: RunResult;
  contract: string[];
}) {
  const evidenceDetails = result.evidence?.map((item) => item.detail) ?? [];
  const contractClause = pickContractClause(
    contract,
    result.reasoning ?? "",
    evidenceDetails
  );
  const excerpts = buildRedactedExcerpts(
    evidenceDetails,
    result.reasoning ?? ""
  );

  return {
    traceId: result.traceId,
    cluster: result.cluster,
    contract_clause: contractClause,
    redacted_evidence: excerpts.join(" / ") || redactText("Failure detected."),
  };
}
