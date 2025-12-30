import YAML from "yaml";
import { parseRules } from "@/lib/rules";

type ValidationResult = {
  error?: string;
  warning?: string;
};

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
  if (!text.trim()) {
    return { error: "Judge rubric is empty." };
  }

  const jsonBlock = extractJsonBlock(text);
  if (!jsonBlock) {
    return {
      warning:
        "Consider adding a JSON output schema (pass, severity, cluster, reason) to reduce judge variance.",
    };
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
