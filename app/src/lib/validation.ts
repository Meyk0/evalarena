import YAML from "yaml";
import { parseRules } from "@/lib/rules";

type ValidationResult = {
  error?: string;
  warning?: string;
};

function isBlankValue(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  return false;
}

function isRulesSkeleton(data: unknown) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const rulesValue = (data as { rules?: unknown }).rules;
  if (!Array.isArray(rulesValue) || rulesValue.length === 0) {
    return false;
  }

  const expectedKeys = ["id", "when", "require", "severity", "notes"];

  return rulesValue.every((rule) => {
    if (!rule || typeof rule !== "object") {
      return false;
    }
    const record = rule as Record<string, unknown>;
    if (!expectedKeys.every((key) => key in record)) {
      return false;
    }
    return expectedKeys.every((key) => isBlankValue(record[key]));
  });
}

function formatYamlError(error: { message: string; linePos?: Array<{ line: number; col: number }> }) {
  const pos = error.linePos?.[0];
  const location = pos ? ` (line ${pos.line}, col ${pos.col})` : "";
  return `YAML error${location}: ${error.message}`;
}

export function validateRulesConfig(text: string): ValidationResult {
  if (!text.trim()) {
    return { error: "Rules YAML is empty." };
  }

  const doc = YAML.parseDocument(text);
  if (doc.errors.length > 0) {
    return { error: formatYamlError(doc.errors[0]) };
  }

  if (isRulesSkeleton(doc.toJSON())) {
    return {};
  }

  try {
    parseRules(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid rules.";
    return { error: message };
  }

  return {};
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  return null;
}

export function validateJudgeConfig(text: string): ValidationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Judge rubric is empty." };
  }

  if (trimmed.length < 40) {
    return {
      error:
        "Judge rubric is too short. Describe pass/fail criteria tied to the contract.",
    };
  }

  const requiredSignals = [
    "contract",
    "fail",
    "must",
    "require",
    "violation",
    "cite",
    "tool",
    "doc_id",
  ];
  const hasSignal = requiredSignals.some((signal) =>
    trimmed.toLowerCase().includes(signal)
  );
  if (!hasSignal) {
    return {
      warning:
        "Rubric looks vague. Mention contract clauses or required tools/citations.",
    };
  }

  const jsonBlock = extractJsonBlock(text);
  if (!jsonBlock) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    return { error: `Judge JSON schema is invalid: ${message}` };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Judge JSON schema must be a JSON object." };
  }

  const requiredKeys = ["pass", "severity", "cluster", "reason"];
  const missing = requiredKeys.filter((key) => !(key in parsed));

  if (missing.length > 0) {
    return {
      error: `Judge JSON schema missing keys: ${missing.join(", ")}.`,
    };
  }

  return {};
}
