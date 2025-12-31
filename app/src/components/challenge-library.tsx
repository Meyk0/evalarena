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
        <header className="rounded-md border border-border bg-card/80 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Challenge Library
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
            EvalArena
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Build evaluation guardrails you can trust. Pick a scenario, tune
            the rubric or rules, and validate against hidden regressions.
          </p>
        </header>

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
