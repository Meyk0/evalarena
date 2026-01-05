import { createBrowserClient } from "@/lib/supabase/browser";
import type { RunResponse } from "@/lib/types";

type ActiveTab = "rules" | "judge";

type RunTarget = "dev" | "test";

export type ProgressState = {
  solvedChallengeIds: string[];
  completedChallengeIds: string[];
  devReadyChallengeIds: string[];
};

export type ProfileState = {
  id: string;
  name: string;
};

const RUN_HISTORY_PREFIX = "evalarena_run_v1";
const RUN_PREV_PREFIX = "evalarena_run_prev_v1";
const RUN_LAST_PREFIX = "evalarena_run_last_v1";
const EVAL_DRAFT_PREFIX = "evalarena_eval_v1";
const PROGRESS_KEY = "evalarena_progress_v1";
const PROFILE_KEY = "evalarena_profile_v1";

function getRunKey(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget
) {
  return `${RUN_HISTORY_PREFIX}:${challengeId}:${activeTab}:${targetSet}`;
}

function getRunPrevKey(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget
) {
  return `${RUN_PREV_PREFIX}:${challengeId}:${activeTab}:${targetSet}`;
}

function getRunLastKey(challengeId: string, activeTab: ActiveTab) {
  return `${RUN_LAST_PREFIX}:${challengeId}:${activeTab}`;
}

export function loadRunResponse(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget
): RunResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = getRunKey(challengeId, activeTab, targetSet);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RunResponse;
  } catch {
    return null;
  }
}

function loadRunPrev(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget
) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = getRunPrevKey(challengeId, activeTab, targetSet);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RunResponse;
  } catch {
    return null;
  }
}

export function saveRunResponse(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget,
  response: RunResponse
) {
  if (typeof window === "undefined") {
    return;
  }

  const key = getRunKey(challengeId, activeTab, targetSet);
  window.localStorage.setItem(key, JSON.stringify(response));
}

export function loadRunHistory(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget
) {
  return {
    current: loadRunResponse(challengeId, activeTab, targetSet),
    previous: loadRunPrev(challengeId, activeTab, targetSet),
  };
}

export function saveRunHistory(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget,
  response: RunResponse
) {
  if (typeof window === "undefined") {
    return null;
  }

  const current = loadRunResponse(challengeId, activeTab, targetSet);
  if (current) {
    const prevKey = getRunPrevKey(challengeId, activeTab, targetSet);
    window.localStorage.setItem(prevKey, JSON.stringify(current));
  }

  saveRunResponse(challengeId, activeTab, targetSet, response);

  const lastKey = getRunLastKey(challengeId, activeTab);
  window.localStorage.setItem(
    lastKey,
    JSON.stringify({ targetSet, timestamp: Date.now() })
  );

  return current;
}

export function loadLastRunState(
  challengeId: string,
  activeTab: ActiveTab
) {
  if (typeof window === "undefined") {
    return null;
  }

  const lastKey = getRunLastKey(challengeId, activeTab);
  const raw = window.localStorage.getItem(lastKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { targetSet?: RunTarget };
    if (!parsed?.targetSet) {
      return null;
    }

    const history = loadRunHistory(
      challengeId,
      activeTab,
      parsed.targetSet
    );
    if (!history.current) {
      return null;
    }

    return {
      targetSet: parsed.targetSet,
      current: history.current,
      previous: history.previous,
    };
  } catch {
    return null;
  }
}

export function loadProgress(): ProgressState {
  if (typeof window === "undefined") {
    return {
      solvedChallengeIds: [],
      completedChallengeIds: [],
      devReadyChallengeIds: [],
    };
  }

  const raw = window.localStorage.getItem(PROGRESS_KEY);
  if (!raw) {
    return {
      solvedChallengeIds: [],
      completedChallengeIds: [],
      devReadyChallengeIds: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      solvedChallengeIds: Array.isArray(parsed.solvedChallengeIds)
        ? parsed.solvedChallengeIds
        : [],
      completedChallengeIds: Array.isArray(parsed.completedChallengeIds)
        ? parsed.completedChallengeIds
        : [],
      devReadyChallengeIds: Array.isArray(parsed.devReadyChallengeIds)
        ? parsed.devReadyChallengeIds
        : [],
    };
  } catch {
    return {
      solvedChallengeIds: [],
      completedChallengeIds: [],
      devReadyChallengeIds: [],
    };
  }
}

export function saveProgress(progress: ProgressState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  void syncProgress(progress);
}

export function markDevReady(challengeId: string) {
  const progress = loadProgress();
  const next = {
    ...progress,
    devReadyChallengeIds: Array.from(
      new Set([...progress.devReadyChallengeIds, challengeId])
    ),
  };

  saveProgress(next);
  return next;
}

export function markSolved(challengeId: string) {
  const progress = loadProgress();
  const next = {
    ...progress,
    solvedChallengeIds: Array.from(
      new Set([...progress.solvedChallengeIds, challengeId])
    ),
  };

  saveProgress(next);
  return next;
}

export function markCompleted(challengeId: string) {
  const progress = loadProgress();
  const next = {
    solvedChallengeIds: Array.from(
      new Set([...progress.solvedChallengeIds, challengeId])
    ),
    completedChallengeIds: Array.from(
      new Set([...progress.completedChallengeIds, challengeId])
    ),
    devReadyChallengeIds: Array.from(
      new Set([...progress.devReadyChallengeIds, challengeId])
    ),
  };

  saveProgress(next);
  return next;
}

export function loadEvalDraft(
  challengeId: string,
  activeTab: ActiveTab
): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `${EVAL_DRAFT_PREFIX}:${challengeId}:${activeTab}`;
  const raw = window.localStorage.getItem(key);
  return raw ?? null;
}

export function saveEvalDraft(
  challengeId: string,
  activeTab: ActiveTab,
  value: string
) {
  if (typeof window === "undefined") {
    return;
  }

  const key = `${EVAL_DRAFT_PREFIX}:${challengeId}:${activeTab}`;
  window.localStorage.setItem(key, value);
}

export function loadProfile(): ProfileState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ProfileState;
    if (!parsed?.id || !parsed?.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(profile: ProfileState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  void syncProfile(profile);
}

export function ensureProfile(name: string) {
  const existing = loadProfile();
  if (existing) {
    if (existing.name !== name) {
      const updated = { ...existing, name };
      saveProfile(updated);
      return updated;
    }
    return existing;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `profile_${Date.now()}`;
  const profile = { id, name };
  saveProfile(profile);
  return profile;
}

async function syncProfile(profile: ProfileState) {
  try {
    const supabase = createBrowserClient();
    await supabase.from("profiles").upsert({
      id: profile.id,
      display_name: profile.name,
    });
  } catch {
    // Ignore sync failures for MVP.
  }
}

async function syncProgress(progress: ProgressState) {
  const profile = loadProfile();
  if (!profile) {
    return;
  }

  try {
    const supabase = createBrowserClient();
    const solved = new Set(progress.solvedChallengeIds);
    const completed = new Set(progress.completedChallengeIds);
    const devReady = new Set(progress.devReadyChallengeIds);
    const allIds = new Set([
      ...progress.solvedChallengeIds,
      ...progress.completedChallengeIds,
      ...progress.devReadyChallengeIds,
    ]);

    const rows = Array.from(allIds).map((challengeId) => ({
      profile_id: profile.id,
      challenge_id: challengeId,
      solved: solved.has(challengeId),
      completed: completed.has(challengeId),
      dev_ready: devReady.has(challengeId),
    }));

    if (rows.length === 0) {
      return;
    }

    await supabase
      .from("progress")
      .upsert(rows, { onConflict: "profile_id,challenge_id" });
  } catch {
    // Ignore sync failures for MVP.
  }
}
