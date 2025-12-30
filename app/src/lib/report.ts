import type { RunResult } from "@/lib/types";

const stopwords = new Set([
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
  "within",
  "about",
  "above",
  "below",
  "between",
  "during",
  "over",
  "under",
  "against",
  "among",
  "before",
  "after",
  "again",
  "further",
  "once",
  "here",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "could",
  "should",
  "would",
  "might",
  "must",
  "shall",
  "may",
  "you",
  "your",
  "we",
  "us",
  "i",
  "me",
  "my",
  "mine",
  "he",
  "him",
  "his",
  "she",
  "her",
  "hers",
  "they",
  "them",
  "theirs",
  "ours",
]);

function maskCore(core: string) {
  if (core.length <= 4) {
    return core;
  }
  return `${core.slice(0, 2)}${"*".repeat(core.length - 2)}`;
}

export function redactText(text: string) {
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (!/[A-Za-z0-9]/.test(token)) {
        return token;
      }

      if (/\d/.test(token)) {
        return token;
      }

      const match = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)([^A-Za-z0-9]*)$/);
      if (!match) {
        return token;
      }

      const [, leading, core, trailing] = match;
      if (stopwords.has(core.toLowerCase())) {
        return token;
      }

      return `${leading}${maskCore(core)}${trailing}`;
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
  const evidenceLines =
    result.evidence?.map((item) => `msg idx ${item.idx}: ${item.detail}`) ?? [];
  const contractClause = pickContractClause(
    contract,
    result.reasoning ?? "",
    evidenceDetails
  );
  const excerpts = buildRedactedExcerpts(
    evidenceLines,
    result.reasoning ?? ""
  );

  return {
    traceId: result.traceId,
    cluster: result.cluster,
    contract_clause: contractClause,
    redacted_evidence: excerpts.join(" / ") || redactText("Failure detected."),
  };
}
