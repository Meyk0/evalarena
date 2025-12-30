import type { RunResponse, RunResult } from "@/lib/types";

export type DiffEntry = {
  traceId: string;
  cluster: string;
  severity: RunResult["severity"];
};

export type DiffSummary = {
  fixed: DiffEntry[];
  regressed: DiffEntry[];
  newFails: DiffEntry[];
};

function buildResultMap(results: RunResult[]) {
  const map = new Map<string, RunResult>();
  results.forEach((result) => {
    map.set(result.traceId, result);
  });
  return map;
}

export function computeDiff(
  current: RunResponse | null,
  previous: RunResponse | null
): DiffSummary {
  if (!current?.results?.length || !previous?.results?.length) {
    return { fixed: [], regressed: [], newFails: [] };
  }

  const currentMap = buildResultMap(current.results);
  const previousMap = buildResultMap(previous.results);

  const fixed: DiffEntry[] = [];
  const regressed: DiffEntry[] = [];
  const newFails: DiffEntry[] = [];

  currentMap.forEach((currentResult, traceId) => {
    const previousResult = previousMap.get(traceId);

    if (currentResult.status === "fail") {
      if (!previousResult) {
        newFails.push({
          traceId,
          cluster: currentResult.cluster,
          severity: currentResult.severity,
        });
        return;
      }

      if (previousResult.status === "pass") {
        regressed.push({
          traceId,
          cluster: currentResult.cluster,
          severity: currentResult.severity,
        });
      }

      return;
    }

    if (previousResult?.status === "fail") {
      fixed.push({
        traceId,
        cluster: previousResult.cluster,
        severity: previousResult.severity,
      });
    }
  });

  return { fixed, regressed, newFails };
}
