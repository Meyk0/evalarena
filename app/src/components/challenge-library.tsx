"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChallengeCard from "@/components/challenge-card";
import {
  ensureProfile,
  loadProfile,
  loadProgress,
  type ProfileState,
  type ProgressState,
} from "@/lib/storage";
import type { ChallengeSummary, WorldSummary } from "@/lib/types";

type ChallengeLibraryProps = {
  challenges: ChallengeSummary[];
  worlds: WorldSummary[];
};

export default function ChallengeLibrary({
  challenges,
  worlds,
}: ChallengeLibraryProps) {
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressState>({
    solvedChallengeIds: [],
    completedChallengeIds: [],
    devReadyChallengeIds: [],
  });
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameModalMode, setNameModalMode] = useState<"start" | "edit">("start");
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(
    null
  );
  const [nameInput, setNameInput] = useState("");
  const [unlockedWorldModal, setUnlockedWorldModal] =
    useState<WorldSummary | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
    const storedProfile = loadProfile();
    setProfile(storedProfile);
    setNameInput(storedProfile?.name ?? "");
  }, []);

  const filtered = useMemo(() => challenges, [challenges]);

  const worldList = useMemo(() => {
    return [...worlds].sort((a, b) => a.order_index - b.order_index);
  }, [worlds]);
  const challengesByWorld = useMemo(() => {
    const map = new Map<string, ChallengeSummary[]>();
    challenges.forEach((challenge) => {
      const worldId = challenge.world_id ?? "ungrouped";
      const list = map.get(worldId) ?? [];
      list.push(challenge);
      map.set(worldId, list);
    });
    map.forEach((list) =>
      list.sort(
        (a, b) => (a.world_order ?? 0) - (b.world_order ?? 0)
      )
    );
    return map;
  }, [challenges]);

  const completedSet = useMemo(
    () => new Set(progress.completedChallengeIds),
    [progress.completedChallengeIds]
  );
  const devReadySet = useMemo(
    () => new Set(progress.devReadyChallengeIds),
    [progress.devReadyChallengeIds]
  );
  const solvedSet = useMemo(
    () => new Set(progress.solvedChallengeIds),
    [progress.solvedChallengeIds]
  );
  const showDemoCallout = useMemo(() => {
    return (
      completedSet.size === 0 &&
      devReadySet.size === 0 &&
      solvedSet.size === 0
    );
  }, [completedSet, devReadySet, solvedSet]);

  const worldProgress = useMemo(() => {
    const progressByWorld = new Map<
      string,
      { solved: number; total: number; required: number }
    >();
    worldList.forEach((world) => {
      const list = challengesByWorld.get(world.id) ?? [];
      const solved = list.filter((challenge) => solvedSet.has(challenge.id))
        .length;
      const total = list.length;
      const required = Math.min(world.required_count, total);
      progressByWorld.set(world.id, { solved, total, required });
    });
    return progressByWorld;
  }, [worldList, challengesByWorld, solvedSet]);

  const unlockedWorlds = useMemo(() => {
    const unlocked = new Set<string>();
    worldList.forEach((world, index) => {
      if (index === 0) {
        unlocked.add(world.id);
        return;
      }
      const prevWorld = worldList[index - 1];
      const prevProgress = worldProgress.get(prevWorld.id);
      if (prevProgress && prevProgress.solved >= prevProgress.required) {
        unlocked.add(world.id);
      }
    });
    return unlocked;
  }, [worldList, worldProgress]);

  const currentWorld = useMemo(() => {
    for (const world of worldList) {
      const progressState = worldProgress.get(world.id);
      if (!progressState) {
        continue;
      }
      if (!unlockedWorlds.has(world.id)) {
        return world;
      }
      if (progressState.solved < progressState.required) {
        return world;
      }
    }
    return worldList[worldList.length - 1] ?? null;
  }, [worldList, worldProgress, unlockedWorlds]);
  const defaultStartId = useMemo(() => {
    if (worldList.length > 0) {
      const world = currentWorld ?? worldList[0];
      const worldChallenges = challengesByWorld.get(world.id) ?? [];
      if (worldChallenges.length > 0) {
        return worldChallenges[0].id;
      }
      const firstWorldChallenges = challengesByWorld.get(worldList[0].id) ?? [];
      if (firstWorldChallenges.length > 0) {
        return firstWorldChallenges[0].id;
      }
    }
    return challenges[0]?.id ?? null;
  }, [worldList, currentWorld, challengesByWorld, challenges]);

  const points = useMemo(() => {
    return solvedSet.size * 100;
  }, [solvedSet]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = () => {
      if (!profile) {
        setNameModalMode("start");
        setPendingChallengeId(defaultStartId);
        setShowNameModal(true);
        return;
      }
      if (defaultStartId) {
        router.push(`/c/${defaultStartId}`);
      }
    };
    window.addEventListener("evalarena:start", handler);
    return () => window.removeEventListener("evalarena:start", handler);
  }, [profile, defaultStartId, router]);

  useEffect(() => {
    if (!worldList.length) {
      return;
    }
    const unlockKey = "evalarena_world_unlocks_v1";
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(unlockKey)
        : null;
    const seen = raw ? (JSON.parse(raw) as string[]) : [];
    const unlockedIds = Array.from(unlockedWorlds);
    if (seen.length === 0) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(unlockKey, JSON.stringify(unlockedIds));
      }
      return;
    }
    const newlyUnlocked = unlockedIds.find((id) => !seen.includes(id));
    if (newlyUnlocked) {
      const world = worldList.find((item) => item.id === newlyUnlocked);
      if (world) {
        setUnlockedWorldModal(world);
      }
      const nextSeen = Array.from(new Set([...seen, ...unlockedIds]));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(unlockKey, JSON.stringify(nextSeen));
      }
    }
  }, [worldList, unlockedWorlds]);

  const handleStartChallenge = (challenge: ChallengeSummary) => {
    if (!profile) {
      setNameModalMode("start");
      setPendingChallengeId(challenge.id);
      setShowNameModal(true);
      return false;
    }
    return true;
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      return;
    }
    const nextProfile = ensureProfile(trimmed);
    setProfile(nextProfile);
    setShowNameModal(false);
    const targetId = pendingChallengeId ?? defaultStartId;
    if (targetId) {
      router.push(`/c/${targetId}`);
    }
    setPendingChallengeId(null);
  };

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
              {showDemoCallout ? (
                <Link
                  href="/demo"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-foreground"
                >
                  New? Try the demo walkthrough -&gt;
                </Link>
              ) : null}
              <p className="mt-2 text-muted-foreground">
                Each challenge includes a contract, traces, and hidden tests.
              </p>
            </div>
            <div className="space-y-2 text-right text-sm text-muted-foreground">
              <p>
                {profile ? (
                  <>
                    Welcome,{" "}
                    <span className="font-semibold text-foreground">
                      {profile.name}
                    </span>
                  </>
                ) : (
                  "Pick a challenge to set your name."
                )}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span>
                  Points:{" "}
                  <span className="font-semibold text-foreground">
                    {points}
                  </span>
                </span>
                {profile ? (
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-accent hover:text-foreground"
                    onClick={() => {
                      setNameModalMode("edit");
                      setPendingChallengeId(null);
                      setNameInput(profile.name);
                      setShowNameModal(true);
                    }}
                  >
                    Change name
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          {currentWorld ? (
            <div className="mt-4 rounded-xl border border-border bg-secondary/60 p-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Current world
                  </span>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {currentWorld.title}
                  </p>
                </div>
                {worldProgress.has(currentWorld.id) ? (
                  <p className="text-[11px] text-muted-foreground">
                    Progress: {worldProgress.get(currentWorld.id)?.solved ?? 0} /{" "}
                    {worldProgress.get(currentWorld.id)?.required ?? 0} solved
                  </p>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentWorld.description}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-10">
          {worldList.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    World map
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    Your progression path
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Solve 2 challenges per world to unlock the next.
                  </p>
                </div>
                <div className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                  {solvedSet.size} solved total
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {worldList.map((world, index) => {
                  const progressState = worldProgress.get(world.id);
                  const isUnlocked = unlockedWorlds.has(world.id);
                  const isActive = currentWorld?.id === world.id;
                  return (
                    <div
                      key={`world-map-${world.id}`}
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        isUnlocked
                          ? "border-border bg-background"
                          : "border-border/60 bg-muted/40 text-muted-foreground"
                      } ${isActive ? "ring-2 ring-accent/40" : ""}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        World {world.order_index}
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {world.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {world.description}
                      </p>
                      {progressState ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {progressState.solved}/{progressState.required} solved
                        </p>
                      ) : null}
                      {!isUnlocked && index > 0 ? (
                        <p className="mt-2 text-xs text-amber-700">
                          Locked
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {worldList.length === 0 ? (
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
                    solved={solvedSet.has(challenge.id)}
                    onStart={handleStartChallenge}
                  />
                ))
              )}
            </div>
          ) : (
            worldList.map((world) => {
              const worldChallenges = challengesByWorld.get(world.id) ?? [];
              const worldFiltered = worldChallenges.filter((challenge) =>
                filtered.some((item) => item.id === challenge.id)
              );
              const isUnlocked = unlockedWorlds.has(world.id);
              const progressState = worldProgress.get(world.id);
              return (
                <div key={world.id} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        World {world.order_index}
                      </p>
                      <h3 className="text-2xl font-semibold text-foreground">
                        {world.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {world.description}
                      </p>
                    </div>
                    <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                      {progressState ? (
                        <>
                          {progressState.solved}/{progressState.required} solved
                        </>
                      ) : (
                        "No challenges"
                      )}
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {worldFiltered.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
                        No challenges match those filters.
                      </div>
                    ) : (
                      worldFiltered.map((challenge) => (
                        <ChallengeCard
                          key={challenge.id}
                          challenge={challenge}
                          completed={completedSet.has(challenge.id)}
                          devReady={devReadySet.has(challenge.id)}
                          solved={solvedSet.has(challenge.id)}
                          locked={!isUnlocked}
                          onStart={handleStartChallenge}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {showNameModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Set your name
            </p>
            <h3 className="mt-2 text-lg font-semibold">
              {nameModalMode === "edit" ? "Update your name" : "Choose a display name"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {nameModalMode === "edit"
                ? "This updates the name shown in the leaderboard later."
                : "We use this to track your progress and points."}
            </p>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="e.g. Alex"
              className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-foreground"
                onClick={() => {
                  setShowNameModal(false);
                  setPendingChallengeId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:opacity-90"
                onClick={handleSaveName}
              >
                Save name
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {unlockedWorldModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-foreground shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Mission briefing
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              {unlockedWorldModal.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {unlockedWorldModal.description}
            </p>
            <div className="mt-4 rounded-xl border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
              Complete {unlockedWorldModal.required_count} challenges in this
              world to unlock the next.
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <a
                href="/playbook"
                className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:border-accent"
              >
                Open playbook
              </a>
              <button
                type="button"
                className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:opacity-90"
                onClick={() => setUnlockedWorldModal(null)}
              >
                Start this world
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
