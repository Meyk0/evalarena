import type { RunResponse } from "@/lib/types";

type ActiveTab = "rules" | "judge";

type RunTarget = "dev" | "test";

const RUN_HISTORY_PREFIX = "evalarena_run_v1";
const EVAL_DRAFT_PREFIX = "evalarena_eval_v1";

function getRunKey(
  challengeId: string,
  activeTab: ActiveTab,
  targetSet: RunTarget
) {
  return `${RUN_HISTORY_PREFIX}:${challengeId}:${activeTab}:${targetSet}`;
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
