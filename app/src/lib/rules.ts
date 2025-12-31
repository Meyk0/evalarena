import YAML from "yaml";
import type { RunResult, Trace } from "@/lib/types";

export type RuleSeverity = "low" | "high" | "critical";

type ConditionType = "agent_says" | "user_requests";

type RequirementType = "tool_called";

export type Rule = {
  id: string;
  when: RuleCondition;
  require?: RuleRequirement;
  action?: "fail";
  severity: RuleSeverity;
  notes?: string;
};

type RuleCondition = {
  raw: string;
  type: ConditionType;
  pattern: string;
  isRegex: boolean;
  regex?: RegExp;
  matcher: (content: string) => boolean;
};

type RuleRequirement = {
  raw: string;
  type: RequirementType;
  tools: string[];
};

export type RuleFailure = {
  rule: Rule;
  matchIndex: number;
  detail: string;
};

export type TraceEvaluation = {
  traceId: string;
  result: RunResult;
  failures: RuleFailure[];
  matchedRules: string[];
};

const severityRank: Record<RuleSeverity, number> = {
  low: 1,
  high: 2,
  critical: 3,
};

function parseCallExpression(raw: string) {
  const match = raw.match(/^(\w+)\((.*)\)$/);
  if (!match) {
    throw new Error(`Invalid expression: ${raw}`);
  }

  return {
    name: match[1],
    args: parseArgs(match[2]),
  };
}

function parseArgs(argsText: string) {
  const args: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(argsText)) !== null) {
    args.push(match[1] ?? match[2] ?? "");
  }

  if (args.length > 0) {
    return args;
  }

  const trimmed = argsText.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildMatcher(pattern: string) {
  if (pattern.startsWith("re:")) {
    const body = pattern.slice(3).trim();
    if (!body) {
      throw new Error("Regex pattern cannot be empty.");
    }

    const regex = new RegExp(body, "i");
    return {
      isRegex: true,
      regex,
      matcher: (content: string) => regex.test(content),
    };
  }

  const needle = pattern.toLowerCase();
  return {
    isRegex: false,
    matcher: (content: string) => content.toLowerCase().includes(needle),
  };
}

function parseCondition(raw: string): RuleCondition {
  const { name, args } = parseCallExpression(raw);

  if (name !== "agent_says" && name !== "user_requests") {
    throw new Error(`Unsupported condition: ${name}`);
  }

  if (args.length !== 1) {
    throw new Error(`Condition ${name} expects a single pattern.`);
  }

  const pattern = args[0];
  const { isRegex, regex, matcher } = buildMatcher(pattern);

  return {
    raw,
    type: name,
    pattern,
    isRegex,
    regex,
    matcher,
  };
}

function parseRequirement(raw: string): RuleRequirement {
  const { name, args } = parseCallExpression(raw);

  if (name !== "tool_called") {
    throw new Error(`Unsupported requirement: ${name}`);
  }

  if (args.length === 0) {
    throw new Error("tool_called requires at least one tool name.");
  }

  return {
    raw,
    type: name,
    tools: args,
  };
}

export function parseRules(configText: string): Rule[] {
  if (!configText.trim()) {
    throw new Error("Eval config is empty.");
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(configText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid YAML.";
    throw new Error(`Invalid YAML: ${message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Eval config must be a YAML object.");
  }

  const rulesValue = (parsed as { rules?: unknown }).rules;
  if (!Array.isArray(rulesValue)) {
    throw new Error("Eval config must include a rules array.");
  }

  return rulesValue.map((rule, index) => {
    if (!rule || typeof rule !== "object") {
      throw new Error(`Rule at index ${index} must be an object.`);
    }

    const data = rule as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id.trim() : "";
    const when = typeof data.when === "string" ? data.when.trim() : "";
    const severity =
      typeof data.severity === "string"
        ? (data.severity as RuleSeverity)
        : "low";
    const notes = typeof data.notes === "string" ? data.notes : undefined;

    if (!id) {
      throw new Error(`Rule at index ${index} is missing an id.`);
    }

    if (!when) {
      throw new Error(`Rule ${id} is missing a when clause.`);
    }

    if (!Object.keys(severityRank).includes(severity)) {
      throw new Error(`Rule ${id} has invalid severity: ${String(severity)}.`);
    }

    const action = typeof data.action === "string" ? data.action : undefined;
    if (action && action !== "fail") {
      throw new Error(`Rule ${id} has invalid action: ${String(action)}.`);
    }

    const requireRaw =
      typeof data.require === "string" ? data.require : undefined;

    if (!requireRaw && !action) {
      throw new Error(`Rule ${id} must include require or action.`);
    }

    return {
      id,
      when: parseCondition(when),
      require: requireRaw ? parseRequirement(requireRaw) : undefined,
      action,
      severity,
      notes,
    } satisfies Rule;
  });
}

function matchCondition(condition: RuleCondition, trace: Trace) {
  const indices: number[] = [];

  trace.messages.forEach((message, index) => {
    if (condition.type === "agent_says" && message.role !== "assistant") {
      return;
    }
    if (condition.type === "user_requests" && message.role !== "user") {
      return;
    }

    if (condition.matcher(message.content)) {
      indices.push(index);
    }
  });

  return indices;
}

function extractToolName(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;
  const candidates = [
    metadata.tool_name,
    metadata.tool,
    metadata.name,
  ].filter((value) => typeof value === "string");

  return candidates.length > 0 ? (candidates[0] as string) : undefined;
}

function requirementSatisfied(requirement: RuleRequirement, trace: Trace) {
  if (requirement.type !== "tool_called") {
    return { satisfied: false, missing: requirement.tools };
  }

  const called = new Set(
    trace.messages
      .filter((message) => message.role === "tool")
      .map((message) => extractToolName(message.metadata))
      .filter((tool): tool is string => Boolean(tool))
      .map((tool) => tool.toLowerCase())
  );

  const missing = requirement.tools.filter(
    (tool) => !called.has(tool.toLowerCase())
  );

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

function formatToolList(tools: string[]) {
  if (tools.length === 1) return `"${tools[0]}"`;
  return tools.map((tool) => `"${tool}"`).join(", ");
}

export function evaluateTrace(rules: Rule[], trace: Trace): TraceEvaluation {
  const failures: RuleFailure[] = [];
  const matchedRules: string[] = [];

  for (const rule of rules) {
    const matchIndices = matchCondition(rule.when, trace);
    if (matchIndices.length === 0) {
      continue;
    }

    matchedRules.push(rule.id);
    const matchIndex = matchIndices[0];

    if (rule.action === "fail") {
      failures.push({
        rule,
        matchIndex,
        detail: `Matched ${rule.when.raw}.`,
      });
      continue;
    }

    if (rule.require) {
      const { satisfied, missing } = requirementSatisfied(rule.require, trace);
      if (!satisfied) {
        const missingList = missing.length
          ? `Missing tool_called(${formatToolList(missing)}).`
          : `Missing ${rule.require.raw}.`;
        failures.push({
          rule,
          matchIndex,
          detail: `Matched ${rule.when.raw}. ${missingList}`,
        });
      }
    }
  }

  if (failures.length === 0) {
    return {
      traceId: trace.id,
      result: {
        traceId: trace.id,
        status: "pass",
        severity: "low",
        cluster: "Pass",
        evidence: [],
      },
      failures: [],
      matchedRules,
    };
  }

  const topSeverity = failures.reduce((current, failure) => {
    return severityRank[failure.rule.severity] > severityRank[current]
      ? failure.rule.severity
      : current;
  }, "low" as RuleSeverity);

  const evidence = failures.map((failure) => ({
    idx: failure.matchIndex,
    label: failure.rule.id,
    detail: failure.detail,
    level: "bad" as const,
  }));

  return {
    traceId: trace.id,
    result: {
      traceId: trace.id,
      status: "fail",
      severity: topSeverity,
      cluster: failures[0].rule.id,
      evidence,
    },
    failures,
    matchedRules,
  };
}

export function evaluateTraces(rules: Rule[], traces: Trace[]): TraceEvaluation[] {
  return traces.map((trace) => evaluateTrace(rules, trace));
}
