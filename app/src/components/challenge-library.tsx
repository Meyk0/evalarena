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
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<ProgressState>({
    completedChallengeIds: [],
    devReadyChallengeIds: [],
  });

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return challenges;

    return challenges.filter((challenge) => {
      return [
        challenge.id,
        challenge.title,
        challenge.description,
        challenge.category,
        challenge.difficulty,
        challenge.mode_label,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [challenges, query]);

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
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              EvalArena
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Challenge Library
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pick a scenario, tune your evaluation, and test it against hidden
              regressions. Dev runs are public; prod runs are redacted.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Available
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {challenges.length}
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by challenge, category, or difficulty"
            className="h-10 w-full rounded-xl border border-border bg-card/80 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/30 md:max-w-md"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-1">
              Dev + Test
            </span>
            <span className="rounded-full border border-border px-2 py-1">
              Hidden traces
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
              No challenges match that query.
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
