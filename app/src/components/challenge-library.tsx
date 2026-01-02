"use client";

import { useEffect, useMemo, useState } from "react";
import ChallengeCard from "@/components/challenge-card";
import { loadProgress, type ProgressState } from "@/lib/storage";
import type { ChallengeSummary } from "@/lib/types";

type ChallengeLibraryProps = {
  challenges: ChallengeSummary[];
};

export default function ChallengeLibrary({
  challenges,
}: ChallengeLibraryProps) {
  const [difficultyFilter, setDifficultyFilter] = useState<
    "All" | "Easy" | "Medium" | "Hard"
  >("All");
  const [categoryFilter, setCategoryFilter] = useState<
    "All" | "Performance" | "Safety"
  >("All");
  const [progress, setProgress] = useState<ProgressState>({
    completedChallengeIds: [],
    devReadyChallengeIds: [],
  });

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const filtered = useMemo(() => {
    return challenges.filter((challenge) => {
      if (
        difficultyFilter !== "All" &&
        challenge.difficulty !== difficultyFilter
      ) {
        return false;
      }
      if (categoryFilter !== "All" && challenge.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [challenges, difficultyFilter, categoryFilter]);

  const completedSet = useMemo(
    () => new Set(progress.completedChallengeIds),
    [progress.completedChallengeIds]
  );
  const devReadySet = useMemo(
    () => new Set(progress.devReadyChallengeIds),
    [progress.devReadyChallengeIds]
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6">
        <header className="relative overflow-hidden rounded-md border border-border bg-card/80 p-6 md:p-8">
          <div className="hero-spotlight" aria-hidden="true" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="space-y-4">
              <p className="fade-up text-xs uppercase tracking-[0.35em] text-muted-foreground">
                Challenge Library
              </p>
              <h1 className="fade-up delay-1 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
                <span className="gradient-text">EvalArena</span>
              </h1>
              <p className="fade-up delay-2 max-w-2xl text-base text-muted-foreground">
                Build evaluation guardrails you can trust. Pick a scenario,
                tune the rubric or rules, and validate against hidden
                regressions.
              </p>
              <div className="fade-up delay-2 flex flex-wrap items-center gap-3">
                <a
                  href="#challenges"
                  className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:opacity-90"
                >
                  Pick a challenge
                </a>
                <span className="text-xs text-muted-foreground">
                  Start by reading the contract.
                </span>
              </div>
              <div className="fade-up delay-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {["RAG", "Safety", "Performance"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-border bg-background/70 px-3 py-1"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="fade-up delay-2 w-full lg:max-w-[520px]">
              <div className="rounded-md border border-border bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Eval loop preview
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {["Context", "Eval", "Results"].map((pane) => (
                    <div
                      key={pane}
                      className="rounded-md border border-border bg-card/80 p-3"
                    >
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{pane}</span>
                        <span className="h-2 w-2 rounded-full bg-muted" />
                      </div>
                      <div className="mt-3 space-y-2">
                        <span className="block h-2 w-full rounded-full bg-muted/70" />
                        <span className="block h-2 w-5/6 rounded-full bg-muted/70" />
                        <span className="block h-2 w-3/4 rounded-full bg-muted/70" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Debug → Ship. Visible traces first, hidden tests after.
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-md border border-border bg-card/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Eval loop
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Debug before you ship
              </p>
            </div>
            <div className="flex min-w-[260px] items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-background/70 px-3 py-1 font-semibold text-foreground">
                Debug
              </span>
              <span className="h-px flex-1 bg-border" />
              <span className="rounded-full border border-border bg-background/70 px-3 py-1 font-semibold text-foreground">
                Ship
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Use visible traces to tune the eval, then prove it holds up on
            hidden tests.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Catches regressions",
              body: "Hidden tests reveal unseen failures before you ship.",
            },
            {
              title: "Enforces contracts",
              body: "Tie every rule or rubric back to the contract clauses.",
            },
            {
              title: "Ships safely",
              body: "Only clean runs unlock the Ship step.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-md border border-border bg-card/80 p-4"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Outcome
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {step.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-md border border-border bg-card/80 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Difficulty
            </p>
            <div className="flex flex-wrap gap-2">
              {(["All", "Easy", "Medium", "Hard"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficultyFilter(level)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    difficultyFilter === level
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:border-accent hover:bg-secondary/60"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Category
            </p>
            <div className="flex flex-wrap gap-2">
              {(["All", "Performance", "Safety"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCategoryFilter(label)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    categoryFilter === label
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:border-accent hover:bg-secondary/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section
          id="challenges"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
              No challenges match those filters.
            </div>
          ) : (
            filtered.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                completed={completedSet.has(challenge.id)}
                devReady={devReadySet.has(challenge.id)}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
