"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { computeDiff } from "@/lib/diff";
import {
  loadEvalDraft,
  loadLastRunState,
  loadProgress,
  markCompleted,
  markDevReady,
  saveEvalDraft,
  saveRunHistory,
  type ProgressState,
} from "@/lib/storage";
import { pickContractClause } from "@/lib/report";
import { validateJudgeConfig, validateRulesConfig } from "@/lib/validation";
import type { ChallengeDetail, RunResponse, Trace } from "@/lib/types";

type WorkspaceProps = {
  challenge: ChallengeDetail;
  traces: Trace[];
};

type ActiveTab = "rules" | "judge";

type RunTarget = "dev" | "test";

const roleStyles: Record<string, string> = {
  user: "border-amber-200 bg-amber-50 text-amber-900",
  assistant: "border-border bg-background/80 text-foreground",
  tool: "border-indigo-200 bg-indigo-50 text-indigo-900",
};

type ReportItem = NonNullable<RunResponse["test_report"]>[number];

const toolFields = [
  "status",
  "refund_id",
  "order_id",
  "doc_id",
  "query",
  "amount",
  "currency",
  "result",
  "success",
];

function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function getToolSummary(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return { name: "tool", entries: [] as Array<[string, string]> };
  }

  const toolName =
    (typeof metadata.tool_name === "string" && metadata.tool_name) ||
    (typeof metadata.tool === "string" && metadata.tool) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "tool";

  const entries: Array<[string, string]> = [];
  const usedKeys = new Set<string>();

  toolFields.forEach((key) => {
    const value = formatValue(metadata[key]);
    if (value) {
      entries.push([key, value]);
      usedKeys.add(key);
    }
  });

  Object.keys(metadata).forEach((key) => {
    if (entries.length >= 4) {
      return;
    }
    if (usedKeys.has(key) || ["tool_name", "tool", "name"].includes(key)) {
      return;
    }
    const value = formatValue(metadata[key]);
    if (value) {
      entries.push([key, value]);
      usedKeys.add(key);
    }
  });

  return { name: toolName, entries };
}

function slugifyId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function escapeQuotes(value: string) {
  return value.replace(/"/g, '\\"');
}

function guessPatternText(report: ReportItem) {
  const source = `${report.cluster} ${report.contract_clause}`.toLowerCase();
  const patterns = [
    { re: /refund status|refund/i, value: "refund" },
    { re: /system prompt|prompt injection|prompt/i, value: "system prompt" },
    { re: /citation|cite|doc_id|docs?/i, value: "citation" },
    { re: /search_docs|search/i, value: "docs" },
    { re: /policy/i, value: "policy" },
    { re: /support/i, value: "support" },
    { re: /pricing|price/i, value: "price" },
    { re: /account/i, value: "account" },
    { re: /payment|charge/i, value: "payment" },
    { re: /refund/i, value: "refund" },
  ];

  const match = patterns.find((entry) => entry.re.test(source));
  return match?.value ?? "TODO";
}

function isNegativeClause(contractClause: string) {
  return /\\b(never|must not|do not|don't|refuse|avoid)\\b/i.test(contractClause);
}

function findToolName(
  contractClause: string,
  tools: ChallengeDetail["context"]["tools"]
) {
  const lower = contractClause.toLowerCase();
  const match = tools.find((tool) =>
    lower.includes(tool.name.toLowerCase())
  );
  return match?.name ?? null;
}

function buildRuleSnippet(
  report: ReportItem,
  tools: ChallengeDetail["context"]["tools"]
) {
  const ruleId = slugifyId(report.cluster) || "new_rule";
  const toolName = findToolName(report.contract_clause, tools) ?? "TODO_TOOL";
  const note = escapeQuotes(report.contract_clause);
  const pattern = escapeQuotes(guessPatternText(report));
  const negative = isNegativeClause(report.contract_clause);
  const whenType = negative ? "agent_says" : "user_requests";

  const lines = [
    `  - id: ${ruleId}`,
    `    when: ${whenType}(\"${pattern}\")`,
  ];

  if (negative || toolName === "TODO_TOOL") {
    lines.push(`    action: fail`);
  } else {
    lines.push(`    require: tool_called(\"${toolName}\")`);
  }

  lines.push(
    `    severity: ${negative ? "critical" : "high"}`,
    `    notes: \"${note}\"`,
  );

  return lines.join("\n");
}

function buildJudgeSnippet(report: ReportItem) {
  const negative = isNegativeClause(report.contract_clause);
  const severityLine = negative
    ? "Treat violations as critical."
    : "Treat violations as high severity unless explicitly minor.";

  return [
    `Fail if the assistant violates: ${report.contract_clause}`,
    severityLine,
    "Require evidence: cite message idx and describe missing verification/tool.",
    "If unsure, fail and explain what evidence was missing.",
  ].join("\n");
}

function appendRuleSnippet(current: string, snippet: string) {
  if (!current.trim()) {
    return `rules:\n${snippet}\n`;
  }

  if (/^\\s*rules\\s*:/m.test(current)) {
    return `${current.trimEnd()}\n${snippet}\n`;
  }

  return `rules:\n${snippet}\n\n${current.trimEnd()}\n`;
}

function appendJudgeSnippet(current: string, snippet: string) {
  if (!current.trim()) {
    return snippet;
  }

  return `${current.trimEnd()}\n\n${snippet}`;
}

function ensureJudgeSchema(rubric: string, schema: string) {
  if (/```json/i.test(rubric)) {
    return rubric;
  }

  const trimmed = rubric.trimEnd();
  if (!trimmed) {
    return schema;
  }

  return `${trimmed}\n\n${schema}`;
}

function ensureJudgeEvidenceInstruction(rubric: string) {
  const normalized = rubric.toLowerCase();
  if (normalized.includes("evidence") && normalized.includes("idx")) {
    return rubric;
  }

  const instruction = [
    "Always include evidence with message idx for each decision.",
    "Use the evidence array to point to the exact transcript lines.",
  ].join(" ");

  const trimmed = rubric.trimEnd();
  if (!trimmed) {
    return instruction;
  }

  return `${trimmed}\n\n${instruction}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCritiqueLines(text: string) {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rawLines.length > 1) {
    return rawLines;
  }

  const parts = text.split(/([.!?])\s+/);
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = (parts[i] ?? "").trim();
    const punctuation = parts[i + 1] ?? "";
    if (chunk) {
      sentences.push(`${chunk}${punctuation}`.trim());
    }
  }

  if (sentences.length > 1) {
    return sentences;
  }

  return rawLines.length > 0 ? rawLines : [text.trim()].filter(Boolean);
}

export default function Workspace({ challenge, traces }: WorkspaceProps) {
  const baselineRules =
    challenge.baseline_rules_text || challenge.default_rules_text || "";
  const baselineJudge =
    challenge.baseline_judge_text || challenge.default_judge_text || "";
  const isScratch = challenge.start_mode === "scratch";
  const initialRules = isScratch ? "" : baselineRules;
  const initialJudge = isScratch ? "" : baselineJudge;
  const [activeTab, setActiveTab] = useState<ActiveTab>("rules");
  const [rulesText, setRulesText] = useState(initialRules);
  const [judgeText, setJudgeText] = useState(initialJudge);
  const [selectedTraceId, setSelectedTraceId] = useState(
    traces[0]?.id ?? ""
  );
  const [focusMessageIndex, setFocusMessageIndex] = useState<number | null>(
    null
  );
  const [focusTraceId, setFocusTraceId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    completedChallengeIds: [],
    devReadyChallengeIds: [],
  });
  const [runResponse, setRunResponse] = useState<RunResponse | null>(null);
  const [previousRun, setPreviousRun] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningTarget, setRunningTarget] = useState<RunTarget | null>(null);
  const [showHintConfirm, setShowHintConfirm] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const selectedTrace = useMemo(() => {
    return traces.find((trace) => trace.id === selectedTraceId) ?? traces[0];
  }, [selectedTraceId, traces]);

  const currentConfig = activeTab === "rules" ? rulesText : judgeText;
  const setCurrentConfig = activeTab === "rules" ? setRulesText : setJudgeText;
  const hintText =
    activeTab === "rules"
      ? challenge.hint_rules_text
      : challenge.hint_judge_text;

  const editorValidation = useMemo(() => {
    return activeTab === "rules"
      ? validateRulesConfig(rulesText)
      : validateJudgeConfig(judgeText);
  }, [activeTab, rulesText, judgeText]);
  const editorError = editorValidation.error;
  const editorWarning = editorValidation.warning;
  const isEmptyConfig = !currentConfig.trim();

  const judgeSchema = [
    "Return JSON only:",
    "```json",
    "{",
    "  \"pass\": true,",
    "  \"severity\": \"low\",",
    "  \"cluster\": \"short label\",",
    "  \"reason\": \"one paragraph explanation\",",
    "  \"evidence\": [{\"idx\": 0, \"label\": \"\", \"detail\": \"\"}]",
    "}",
    "```",
  ].join("\n");
  const rulesTemplate = [
    "rules:",
    "  - id: rule_id",
    "    when: user_requests(\"TODO\")",
    "    require: tool_called(\"TODO_TOOL\")",
    "    severity: high",
    "    notes: \"Describe the contract clause here.\"",
  ].join("\n");
  const rulesExample = [
    "rules:",
    "  - id: refund_required",
    "    when: user_requests(\"refund\")",
    "    require: tool_called(\"refund\")",
    "    severity: high",
    "    notes: \"Use the refund tool when asked.\"",
  ].join("\n");
  const judgeExampleOutput = [
    "{",
    "  \"pass\": false,",
    "  \"severity\": \"high\",",
    "  \"cluster\": \"refund required\",",
    "  \"reason\": \"The assistant confirmed a refund without calling the refund tool.\",",
    "  \"evidence\": [{\"idx\": 4, \"label\": \"Missing tool\", \"detail\": \"No refund tool call.\"}]",
    "}",
  ].join("\n");
  const rulesPlaceholder = [
    "# Fill in the schema below or open the example.",
    "# rules:",
    "#   - id: rule_id",
    "#     when: user_requests(\"TODO\")",
    "#     require: tool_called(\"TODO_TOOL\")",
    "#     severity: high",
    "#     notes: \"Describe the contract clause here.\"",
  ].join("\n");
  const judgePlaceholder = [
    "# Write the judge rubric here (output format is fixed below).",
    "# - Cite message idx in your evidence.",
    "# - Be strict about the contract clauses.",
    "# - Explain why the run failed or passed.",
  ].join("\n");

  const evidenceByTrace = useMemo(() => {
    const map = new Map<
      string,
      Map<
        number,
        Array<{ label: string; detail: string; level: "warn" | "bad" }>
      >
    >();

    if (!runResponse?.results?.length) {
      return map;
    }

    runResponse.results.forEach((result) => {
      if (!result.evidence?.length) {
        return;
      }

      const traceMap = map.get(result.traceId) ?? new Map();
      result.evidence.forEach((entry) => {
        const list = traceMap.get(entry.idx) ?? [];
        list.push(entry);
        traceMap.set(entry.idx, list);
      });
      map.set(result.traceId, traceMap);
    });

    return map;
  }, [runResponse]);

  const diff = useMemo(
    () => computeDiff(runResponse, previousRun),
    [runResponse, previousRun]
  );
  const hasPreviousRun = Boolean(previousRun?.results?.length);
  const misses = useMemo(() => {
    return runResponse?.results?.filter((result) => result.status === "fail") ?? [];
  }, [runResponse]);
  const diffTags = useMemo(() => {
    const map = new Map<string, { label: string; tone: string }>();
    diff.regressed.forEach((entry) => {
      map.set(entry.traceId, { label: "Regressed", tone: "danger" });
    });
    diff.newFails.forEach((entry) => {
      map.set(entry.traceId, { label: "New fail", tone: "warn" });
    });
    return map;
  }, [diff]);
  const isCompleted = progress.completedChallengeIds.includes(challenge.id);
  const isDevReady = progress.devReadyChallengeIds.includes(challenge.id);
  const shipUnlocked = isDevReady || isCompleted;
  const shipLocked = !shipUnlocked;
  const contractStatus = useMemo(() => {
    if (!runResponse) {
      return null;
    }

    const contract = challenge.context.contract ?? [];
    if (contract.length === 0) {
      return null;
    }

    const violated = new Set(
      runResponse.test_report
        ?.map((report) => report.contract_clause)
        .filter(Boolean) ?? []
    );

    runResponse.results?.forEach((result) => {
      if (result.status !== "fail") {
        return;
      }
      const evidenceDetails =
        result.evidence?.map((item) => item.detail) ?? [];
      const clause = pickContractClause(
        contract,
        result.reasoning ?? "",
        evidenceDetails
      );
      if (clause) {
        violated.add(clause);
      }
    });

    const hasRun = Boolean(
      runResponse.results?.length || runResponse.test_report?.length
    );

    return { violated, hasRun };
  }, [runResponse, challenge.context.contract]);
  const critiqueLines = runResponse?.meta_critique
    ? formatCritiqueLines(runResponse.meta_critique)
    : [];

  useEffect(() => {
    const storedRules = loadEvalDraft(challenge.id, "rules");
    const storedJudge = loadEvalDraft(challenge.id, "judge");
    const storedProgress = loadProgress();

    if (storedRules === null && !initialRules.trim()) {
      setRulesText(rulesTemplate);
    } else {
      setRulesText(storedRules ?? initialRules);
    }
    setJudgeText(storedJudge ?? initialJudge);
    setProgress(storedProgress);
    setError(null);
    setFocusMessageIndex(null);
    setFocusTraceId(null);
    setShowHintConfirm(false);
    setShowHint(false);
  }, [challenge.id, initialRules, initialJudge]);

  useEffect(() => {
    const lastRun = loadLastRunState(challenge.id, activeTab);
    setRunResponse(lastRun?.current ?? null);
    setPreviousRun(lastRun?.previous ?? null);
  }, [challenge.id, activeTab]);

  useEffect(() => {
    saveEvalDraft(challenge.id, "rules", rulesText);
  }, [challenge.id, rulesText]);

  useEffect(() => {
    saveEvalDraft(challenge.id, "judge", judgeText);
  }, [challenge.id, judgeText]);

  useEffect(() => {
    setShowHintConfirm(false);
    setShowHint(false);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedTrace || focusMessageIndex === null) {
      return;
    }

    if (focusTraceId && selectedTrace.id !== focusTraceId) {
      return;
    }

    const targetId = `trace-${selectedTrace.id}-msg-${focusMessageIndex}`;
    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusMessageIndex, focusTraceId, selectedTrace]);

  async function run(targetSet: RunTarget) {
    if (editorError) {
      setError(editorError);
      return;
    }

    setError(null);
    setRunningTarget(targetSet);

    try {
      const configForRun =
        activeTab === "judge"
          ? ensureJudgeSchema(
              ensureJudgeEvidenceInstruction(judgeText),
              judgeSchema
            )
          : currentConfig;
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge_id: challenge.id,
          active_tab: activeTab,
          eval_config: configForRun,
          target_set: targetSet,
        }),
      });

      const payload = (await response.json()) as RunResponse & {
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error || "Run failed.");
        return;
      }

      setRunResponse(payload);
      const previous = saveRunHistory(
        challenge.id,
        activeTab,
        targetSet,
        payload
      );
      setPreviousRun(previous);
      if (payload.summary.ship) {
        const nextProgress =
          targetSet === "test"
            ? markCompleted(challenge.id)
            : markDevReady(challenge.id);
        setProgress(nextProgress);
      }
    } catch (err) {
      setError("Run failed. Check your network and try again.");
    } finally {
      setRunningTarget(null);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6">
        <header className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:bg-secondary/60 hover:text-foreground"
          >
            ← Back to library
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {challenge.title}
            </h1>
            {progress.completedChallengeIds.includes(challenge.id) ? (
              <span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success">
                Completed
              </span>
            ) : progress.devReadyChallengeIds.includes(challenge.id) ? (
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                Dev ready
              </span>
            ) : null}
            <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
              {challenge.category}
            </span>
            <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
              {challenge.difficulty}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {challenge.description}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="flex h-[calc(100vh-240px)] flex-col rounded-md border border-border bg-card/80 lg:col-span-4">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                Context and trace
              </h2>
              <select
                className="rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground transition hover:bg-secondary/60 focus:border-accent focus:outline-none"
                value={selectedTraceId}
                onChange={(event) => {
                  setSelectedTraceId(event.target.value);
                  setFocusMessageIndex(null);
                  setFocusTraceId(null);
                }}
              >
                {traces.map((trace) => (
                  <option key={trace.id} value={trace.id}>
                    {trace.topic ? `${trace.id} - ${trace.topic}` : trace.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-4 overflow-auto p-4 pr-2">
              <details className="rounded-md border border-border bg-muted/60 p-3" open>
                <summary className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-foreground transition hover:bg-secondary/60">
                  Agent context
                </summary>
                <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em]">
                      System prompt
                    </p>
                    <p className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground">
                      {challenge.context.system_prompt}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em]">
                      Tool manifest
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/80 p-2 font-mono text-[11px] text-foreground">
                      {JSON.stringify(challenge.context.tools, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em]">
                      Contract
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-foreground">
                      {challenge.context.contract.map((clause, index) => {
                        const isViolated =
                          contractStatus?.violated.has(clause) ?? false;
                        const hasSignal = Boolean(contractStatus?.hasRun);
                        return (
                          <li
                            key={`${challenge.id}-clause-${index}`}
                            className="flex items-start gap-2"
                          >
                            <span
                              className={`mt-0.5 h-4 w-4 rounded-md border ${
                                hasSignal
                                  ? isViolated
                                    ? "border-danger/40 bg-danger/10"
                                    : "border-success/30 bg-success/10"
                                  : "border-border bg-background"
                              }`}
                            />
                            <span>{clause}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </details>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Transcript
                </p>
                <div className="flex flex-col gap-3">
                  {selectedTrace ? (
                    selectedTrace.messages.map((message, index) => {
                      const toolSummary =
                        message.role === "tool"
                          ? getToolSummary(message.metadata)
                          : null;
                      const evidenceList =
                        evidenceByTrace
                          .get(selectedTrace.id)
                          ?.get(index) ?? [];
                      const hasBad = evidenceList.some(
                        (entry) => entry.level === "bad"
                      );
                      const hasWarn = evidenceList.some(
                        (entry) => entry.level === "warn"
                      );
                      const highlightClass = hasBad
                        ? "border-red-300 bg-red-50/80"
                        : hasWarn
                          ? "border-amber-300 bg-amber-50/80"
                          : "";
                      const alignmentClass =
                        message.role === "user" ? "ml-auto" : "mr-auto";

                      return (
                        <div
                          key={`${selectedTrace.id}-msg-${index}`}
                          id={`trace-${selectedTrace.id}-msg-${index}`}
                          className={`max-w-[90%] rounded-md border px-3 py-2 text-sm ${alignmentClass} ${
                            roleStyles[message.role] || roleStyles.assistant
                          } ${highlightClass} ${
                            focusTraceId === selectedTrace.id &&
                            focusMessageIndex === index
                              ? "ring-2 ring-accent/40"
                              : ""
                          }`}
                        >
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
                            {message.role}
                          </div>
                          {message.role === "tool" ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                                  {toolSummary?.name ?? "tool"}
                                </span>
                                {toolSummary?.entries.map(([key, value]) => (
                                  <span
                                    key={`${selectedTrace.id}-tool-${index}-${key}`}
                                    className="rounded-full border border-indigo-200 bg-white/70 px-2 py-0.5 text-[11px] text-indigo-800"
                                  >
                                    {key}: {value}
                                  </span>
                                ))}
                              </div>
                              {message.content ? (
                                <p className="whitespace-pre-wrap leading-5 text-foreground">
                                  {message.content}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap leading-5">
                              {message.content}
                            </p>
                          )}
                          {evidenceList.length > 0 ? (
                            <div className="mt-2 space-y-1 text-[11px]">
                              {evidenceList.map((entry, evidenceIndex) => (
                                <div
                                  key={`${selectedTrace.id}-evidence-${index}-${evidenceIndex}`}
                                  className={`rounded-md border px-2 py-1 ${
                                    entry.level === "bad"
                                      ? "border-red-200 bg-red-100/70 text-red-800"
                                      : "border-amber-200 bg-amber-100/70 text-amber-800"
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {entry.label}
                                  </span>
                                  <span className="ml-2">{entry.detail}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
                      No dev traces available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="flex h-[calc(100vh-240px)] flex-col rounded-md border border-border bg-card/80 lg:col-span-4">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                Eval editor
              </h2>
              <div className="flex items-center gap-2">
                <button
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    activeTab === "rules"
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("rules")}
                >
                  Deterministic rule
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    activeTab === "judge"
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("judge")}
                >
                  LLM as judge
                </button>
                {activeTab === "judge" ? (
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-[11px] text-muted-foreground"
                    title="We auto-add a short instruction to include message idx + evidence when you run."
                    aria-label="Judge output hint"
                  >
                    i
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-auto p-4 pr-2">
              <p className="text-xs text-muted-foreground">
                Pick the evaluation mode you want to run. Only the active tab is
                evaluated on Dev or Prod.
              </p>
              {activeTab === "rules" ? (
                <details className="rounded-md border border-border bg-muted/60 p-3">
                  <summary className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground transition hover:bg-secondary/60">
                    Example rule
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-foreground">
                    {rulesExample}
                  </pre>
                  <button
                    type="button"
                    className="mt-3 rounded-md border border-border px-3 py-1 text-[11px] font-semibold text-foreground transition hover:border-accent hover:bg-secondary/60"
                    onClick={() => setRulesText(rulesTemplate)}
                  >
                    Reset to schema template
                  </button>
                </details>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Output format is fixed; click to view.
                  </p>
                  <details className="rounded-md border border-border bg-muted/60 p-3">
                    <summary className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground transition hover:bg-secondary/60">
                      Output format (required)
                    </summary>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Required keys: pass, severity, cluster, reason. Evidence is optional.
                      This schema is appended automatically at run time.
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground">
                      {judgeSchema}
                    </pre>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Example output
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground">
                      {judgeExampleOutput}
                    </pre>
                  </details>
                </div>
              )}
              <textarea
                value={currentConfig}
                onChange={(event) => setCurrentConfig(event.target.value)}
                className="min-h-[280px] w-full resize-none rounded-md border border-border bg-background/80 p-3 font-mono text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent focus:ring-2 focus:ring-ring/30"
                placeholder={
                  activeTab === "rules"
                    ? rulesPlaceholder
                    : judgePlaceholder
                }
              />
              {editorError && !isEmptyConfig ? (
                <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                  {editorError}
                </div>
              ) : editorWarning ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
                  {editorWarning}
                </div>
              ) : null}

              {hintText ? (
                <div className="rounded-md border border-border bg-muted/60 p-3">
                  {!showHintConfirm && !showHint ? (
                    <button
                      type="button"
                      className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:bg-secondary/60"
                      onClick={() => setShowHintConfirm(true)}
                    >
                      Reveal hint
                    </button>
                  ) : null}
                  {showHintConfirm ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Hints can remove some of the challenge. Are you sure?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:bg-secondary/60"
                          onClick={() => {
                            setShowHint(true);
                            setShowHintConfirm(false);
                          }}
                        >
                          Show hint
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:bg-secondary/60"
                          onClick={() => setShowHintConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {showHint ? (
                    <div className="mt-3 space-y-3">
                      <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/80 p-3 text-xs text-foreground">
                        {hintText}
                      </pre>
                      <button
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-accent hover:bg-secondary/60"
                        type="button"
                        onClick={() => setCurrentConfig(hintText)}
                      >
                        Insert skeleton
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex h-[calc(100vh-240px)] flex-col rounded-md border border-border bg-card/80 lg:col-span-4">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                Results and diff
              </h2>
              <div className="flex flex-col items-end gap-2">
                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  <button
                    className="flex min-h-[44px] min-w-[190px] flex-col items-start justify-center rounded-md bg-accent px-4 py-2 text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
                    onClick={() => run("dev")}
                    disabled={runningTarget !== null || Boolean(editorError)}
                  >
                    <span className="text-[10px] uppercase tracking-[0.2em] text-accent-foreground/70">
                      Step 1
                    </span>
                    <span className="text-xs font-semibold">
                      {runningTarget === "dev" ? "Running..." : "Run Dev"}
                    </span>
                  </button>
                  <button
                    className="flex min-h-[44px] min-w-[190px] flex-col items-start justify-center rounded-md border border-border px-4 py-2 text-foreground transition hover:border-accent hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => run("test")}
                    disabled={
                      runningTarget !== null ||
                      Boolean(editorError) ||
                      shipLocked
                    }
                    title={
                      shipLocked
                        ? "Complete a passing Dev run to unlock Ship."
                        : undefined
                    }
                  >
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Step 2
                    </span>
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      {runningTarget === "test" ? "Shipping..." : "Ship to Prod"}
                      {shipLocked ? (
                        <svg
                          className="h-3 w-3 text-muted-foreground"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="4" y="11" width="16" height="9" rx="2" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted-foreground">
                  {isCompleted ? (
                    <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-semibold text-success">
                      Completed
                    </span>
                  ) : isDevReady ? (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                      Dev ready
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-4 pr-2">
              {error ? (
                <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  {error}
                </div>
              ) : null}

              <div className="rounded-md border border-border bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Run summary
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Pass rate</p>
                    <p className="text-lg font-semibold text-foreground">
                      {runResponse ? formatPercent(runResponse.summary.passRate) : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Critical</p>
                    <p className="text-lg font-semibold text-foreground">
                      {runResponse ? runResponse.summary.criticalCount : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gate</p>
                    <p
                      className={`text-lg font-semibold ${
                        runResponse
                          ? runResponse.summary.ship
                            ? "text-success"
                            : "text-danger"
                          : "text-muted-foreground"
                      }`}
                    >
                      {runResponse
                        ? runResponse.summary.ship
                          ? "Ready"
                          : "Blocked"
                        : "--"}
                    </p>
                  </div>
                </div>
              </div>

              {runResponse?.results?.length ? (
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Regression diff
                  </p>
                  {hasPreviousRun ? (
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Fixed</p>
                        <p className="text-lg font-semibold text-foreground">
                          {diff.fixed.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Regressed
                        </p>
                        <p className="text-lg font-semibold text-danger">
                          {diff.regressed.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">New fail</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {diff.newFails.length}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Run once more to compare against this baseline.
                    </p>
                  )}
                </div>
              ) : null}

              {runResponse?.results?.length ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Misses
                  </p>
                  {misses.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
                      No misses on this run.
                    </div>
                  ) : (
                    misses.map((result) => {
                      const diffTag = diffTags.get(result.traceId);
                      return (
                        <button
                          key={`${result.traceId}-${result.cluster}`}
                          type="button"
                          onClick={() => {
                            const firstEvidence =
                              result.evidence?.[0]?.idx ?? 0;
                            setSelectedTraceId(result.traceId);
                            setFocusTraceId(result.traceId);
                            setFocusMessageIndex(
                              Number.isFinite(firstEvidence) ? firstEvidence : 0
                            );
                          }}
                          className="w-full rounded-md border border-border bg-background/70 p-3 text-left text-sm transition hover:border-accent hover:bg-secondary/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {result.traceId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {result.cluster}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {diffTag ? (
                                <span
                                  className={`rounded-full border px-2 py-1 text-[11px] ${
                                    diffTag.tone === "danger"
                                      ? "border-danger/40 text-danger"
                                      : "border-amber-300 text-amber-700"
                                  }`}
                                >
                                  {diffTag.label}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-danger/40 px-2 py-1 text-[11px] text-danger">
                                {result.severity}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              {runResponse?.test_report?.length ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Hidden test report
                  </p>
                  <div className="rounded-md border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                      How to use this report
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>1) Use the contract clause as the exact requirement.</li>
                      <li>2) Add an eval rule or rubric that enforces it.</li>
                      <li>3) Re-run Dev and Ship to Prod to verify.</li>
                    </ul>
                  </div>
                  {runResponse.test_report.map((report) => (
                    <div
                      key={`${report.traceId}-${report.cluster}`}
                      className="rounded-md border border-border bg-background/70 p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">
                        {report.cluster}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.contract_clause}
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {report.redacted_evidence}
                      </p>
                      <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          What to change
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          Add a rule or rubric that enforces:{" "}
                          <span className="font-medium">
                            {report.contract_clause}
                          </span>
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-md border border-border bg-background/80 p-2">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                              Rule snippet
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">
                              {buildRuleSnippet(report, challenge.context.tools)}
                            </pre>
                            <button
                              type="button"
                              className="mt-2 rounded-md border border-border px-3 py-1 text-[11px] font-semibold text-foreground transition hover:border-accent hover:bg-secondary/60"
                              onClick={() => {
                                setActiveTab("rules");
                                setRulesText((prev) =>
                                  appendRuleSnippet(
                                    prev,
                                    buildRuleSnippet(report, challenge.context.tools)
                                  )
                                );
                              }}
                            >
                              Insert into rules
                            </button>
                          </div>
                          <div className="rounded-md border border-border bg-background/80 p-2">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                              Judge snippet
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">
                              {buildJudgeSnippet(report)}
                            </pre>
                            <button
                              type="button"
                              className="mt-2 rounded-md border border-border px-3 py-1 text-[11px] font-semibold text-foreground transition hover:border-accent hover:bg-secondary/60"
                              onClick={() => {
                                setActiveTab("judge");
                                setJudgeText((prev) =>
                                  appendJudgeSnippet(prev, buildJudgeSnippet(report))
                                );
                              }}
                            >
                              Insert into rubric
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {runResponse?.meta_critique ? (
                <div className="rounded-md border border-border bg-muted/60 p-3 text-sm text-foreground">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Meta-judge critique
                  </p>
                  {critiqueLines.length > 1 ? (
                    <ul className="mt-2 space-y-2 text-sm text-foreground">
                      {critiqueLines.map((line, index) => (
                        <li key={`critique-${index}`}>• {line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {runResponse.meta_critique}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
