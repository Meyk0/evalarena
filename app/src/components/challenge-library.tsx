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
    <section id="challenges" className="border-t border-border py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-accent">
                Challenge Library
              </span>
              <h2 className="text-3xl font-bold text-foreground">
                Choose a scenario to start writing evals
              </h2>
              <p className="mt-2 text-muted-foreground">
                Each challenge includes a contract, traces, and hidden tests.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Filters are optional. Pick a card to begin.
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Difficulty
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(["All", "Easy", "Medium", "Hard"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficultyFilter(level)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    difficultyFilter === level
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:border-accent/30 hover:text-foreground"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Category
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(["All", "Performance", "Safety"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCategoryFilter(label)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    categoryFilter === label
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:border-accent/30 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
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
        </div>
      </div>
    </section>
  );
}
