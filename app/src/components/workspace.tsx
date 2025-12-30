"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { computeDiff } from "@/lib/diff";
import {
  loadEvalDraft,
  loadRunResponse,
  saveEvalDraft,
  saveRunResponse,
} from "@/lib/storage";
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function Workspace({ challenge, traces }: WorkspaceProps) {
  const initialRules =
    challenge.default_rules_text || challenge.baseline_rules_text || "";
  const initialJudge =
    challenge.default_judge_text || challenge.baseline_judge_text || "";
  const [activeTab, setActiveTab] = useState<ActiveTab>("rules");
  const [rulesText, setRulesText] = useState(initialRules);
  const [judgeText, setJudgeText] = useState(initialJudge);
  const [selectedTraceId, setSelectedTraceId] = useState(
    traces[0]?.id ?? ""
  );
  const [runResponse, setRunResponse] = useState<RunResponse | null>(null);
  const [previousRun, setPreviousRun] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningTarget, setRunningTarget] = useState<RunTarget | null>(null);

  const selectedTrace = useMemo(() => {
    return traces.find((trace) => trace.id === selectedTraceId) ?? traces[0];
  }, [selectedTraceId, traces]);

  const currentConfig = activeTab === "rules" ? rulesText : judgeText;
  const setCurrentConfig = activeTab === "rules" ? setRulesText : setJudgeText;
  const hintText =
    activeTab === "rules"
      ? challenge.hint_rules_text
      : challenge.hint_judge_text;

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

  useEffect(() => {
    const storedRules = loadEvalDraft(challenge.id, "rules");
    const storedJudge = loadEvalDraft(challenge.id, "judge");

    setRulesText(storedRules ?? initialRules);
    setJudgeText(storedJudge ?? initialJudge);
    setRunResponse(null);
    setPreviousRun(null);
    setError(null);
  }, [challenge.id, initialRules, initialJudge]);

  useEffect(() => {
    saveEvalDraft(challenge.id, "rules", rulesText);
  }, [challenge.id, rulesText]);

  useEffect(() => {
    saveEvalDraft(challenge.id, "judge", judgeText);
  }, [challenge.id, judgeText]);

  async function run(targetSet: RunTarget) {
    setError(null);
    setRunningTarget(targetSet);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge_id: challenge.id,
          active_tab: activeTab,
          eval_config: currentConfig,
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

      const previous = loadRunResponse(challenge.id, activeTab, targetSet);
      setPreviousRun(previous);
      setRunResponse(payload);
      saveRunResponse(challenge.id, activeTab, targetSet, payload);
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
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            Back to library
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {challenge.title}
            </h1>
            <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
              {challenge.category}
            </span>
            <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
              {challenge.difficulty}
            </span>
            <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
              {challenge.mode_label}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {challenge.description}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="flex h-[calc(100vh-240px)] flex-col rounded-xl border border-border bg-card/80 p-4 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Context and trace
              </h2>
              <select
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                value={selectedTraceId}
                onChange={(event) => setSelectedTraceId(event.target.value)}
              >
                {traces.map((trace) => (
                  <option key={trace.id} value={trace.id}>
                    {trace.topic ? `${trace.id} - ${trace.topic}` : trace.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex-1 space-y-4 overflow-auto pr-2">
              <details className="rounded-xl border border-border bg-muted/60 p-3" open>
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Agent context
                </summary>
                <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em]">
                      System prompt
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {challenge.context.system_prompt}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em]">
                      Tool manifest
                    </p>
                    <pre className="mt-2 rounded-lg border border-border bg-background/80 p-2 font-mono text-[11px] text-foreground">
                      {JSON.stringify(challenge.context.tools, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em]">
                      Contract
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-foreground">
                      {challenge.context.contract.map((clause, index) => (
                        <li key={`${challenge.id}-clause-${index}`}>• {clause}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Transcript
                </p>
                <div className="space-y-3">
                  {selectedTrace ? (
                    selectedTrace.messages.map((message, index) => {
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

                      return (
                        <div
                          key={`${selectedTrace.id}-msg-${index}`}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            roleStyles[message.role] || roleStyles.assistant
                          } ${highlightClass}`}
                        >
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
                            {message.role}
                          </div>
                          <p className="whitespace-pre-wrap leading-5">
                            {message.content}
                          </p>
                          {evidenceList.length > 0 ? (
                            <div className="mt-2 space-y-1 text-[11px]">
                              {evidenceList.map((entry, evidenceIndex) => (
                                <div
                                  key={`${selectedTrace.id}-evidence-${index}-${evidenceIndex}`}
                                  className={`rounded-lg border px-2 py-1 ${
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
                          {message.metadata ? (
                            <pre className="mt-2 rounded-lg border border-border bg-background/80 p-2 font-mono text-[11px] text-foreground">
                              {JSON.stringify(message.metadata, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
                      No dev traces available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="flex h-[calc(100vh-240px)] flex-col rounded-xl border border-border bg-card/80 p-4 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Eval editor
              </h2>
              <div className="flex gap-2">
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
              </div>
            </div>
            <div className="mt-3 flex-1 space-y-3 overflow-auto pr-2">
              <textarea
                value={currentConfig}
                onChange={(event) => setCurrentConfig(event.target.value)}
                className="min-h-[280px] w-full resize-none rounded-xl border border-border bg-background/80 p-3 font-mono text-sm leading-5 text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-ring/30"
                placeholder={
                  activeTab === "rules"
                    ? "Write YAML rules here"
                    : "Write judge rubric here"
                }
              />

              {hintText ? (
                <details className="rounded-xl border border-border bg-muted/60 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    Reveal hint
                  </summary>
                  <div className="mt-3 space-y-3">
                    <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background/80 p-3 text-xs text-foreground">
                      {hintText}
                    </pre>
                    <button
                      className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-accent"
                      type="button"
                      onClick={() => setCurrentConfig(hintText)}
                    >
                      Insert skeleton
                    </button>
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          <section className="flex h-[calc(100vh-240px)] flex-col rounded-xl border border-border bg-card/80 p-4 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Results and diff
              </h2>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-lg bg-accent px-4 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
                  onClick={() => run("dev")}
                  disabled={runningTarget !== null}
                >
                  {runningTarget === "dev" ? "Running..." : "Run (Dev)"}
                </button>
                <button
                  className="h-9 rounded-lg border border-border px-4 text-xs font-semibold text-foreground transition hover:border-accent disabled:opacity-60"
                  onClick={() => run("test")}
                  disabled={runningTarget !== null}
                >
                  {runningTarget === "test" ? "Shipping..." : "Ship to Prod"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex-1 space-y-4 overflow-auto pr-2">
              {error ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  {error}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-background/70 p-3">
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
                <div className="rounded-xl border border-border bg-background/70 p-3">
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
                    <div className="rounded-xl border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
                      No misses on this run.
                    </div>
                  ) : (
                    misses.map((result) => {
                      const diffTag = diffTags.get(result.traceId);
                      return (
                        <button
                          key={`${result.traceId}-${result.cluster}`}
                          type="button"
                          onClick={() => setSelectedTraceId(result.traceId)}
                          className="w-full rounded-xl border border-border bg-background/70 p-3 text-left text-sm transition hover:border-accent"
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
                  {runResponse.test_report.map((report) => (
                    <div
                      key={`${report.traceId}-${report.cluster}`}
                      className="rounded-xl border border-border bg-background/70 p-3 text-sm"
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
                    </div>
                  ))}
                </div>
              ) : null}

              {runResponse?.meta_critique ? (
                <div className="rounded-xl border border-border bg-muted/60 p-3 text-sm text-foreground">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Meta-judge critique
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {runResponse.meta_critique}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
