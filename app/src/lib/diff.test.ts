import { describe, expect, it } from "vitest";
import { computeDiff } from "@/lib/diff";
import type { RunResponse } from "@/lib/types";

describe("computeDiff", () => {
  it("detects fixed and regressed traces", () => {
    const previous: RunResponse = {
      results: [
        {
          traceId: "t1",
          status: "fail",
          severity: "high",
          cluster: "missing_tool",
          evidence: [],
        },
        {
          traceId: "t2",
          status: "pass",
          severity: "low",
          cluster: "pass",
          evidence: [],
        },
      ],
      summary: { passRate: 0.5, criticalCount: 0, ship: false },
    };

    const current: RunResponse = {
      results: [
        {
          traceId: "t1",
          status: "pass",
          severity: "low",
          cluster: "pass",
          evidence: [],
        },
        {
          traceId: "t2",
          status: "fail",
          severity: "low",
          cluster: "new_fail",
          evidence: [],
        },
      ],
      summary: { passRate: 0.5, criticalCount: 0, ship: false },
    };

    const diff = computeDiff(current, previous);
    expect(diff.fixed).toHaveLength(1);
    expect(diff.fixed[0].traceId).toBe("t1");
    expect(diff.regressed).toHaveLength(1);
    expect(diff.regressed[0].traceId).toBe("t2");
  });

  it("returns empty when previous is missing", () => {
    const current: RunResponse = {
      results: [
        {
          traceId: "t1",
          status: "fail",
          severity: "high",
          cluster: "missing_tool",
          evidence: [],
        },
      ],
      summary: { passRate: 0, criticalCount: 0, ship: false },
    };

    const diff = computeDiff(current, null);
    expect(diff.fixed).toHaveLength(0);
    expect(diff.regressed).toHaveLength(0);
    expect(diff.newFails).toHaveLength(0);
  });
});
