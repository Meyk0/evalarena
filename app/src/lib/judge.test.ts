import { describe, expect, it } from "vitest";
import { buildJudgeFailure, parseJudgeOutput } from "@/lib/judge";

describe("parseJudgeOutput", () => {
  it("parses valid judge JSON", () => {
    const parsed = parseJudgeOutput(
      JSON.stringify({
        pass: false,
        severity: "high",
        cluster: "missing_tool",
        reason: "Tool was not called.",
        evidence: [{ idx: 1, label: "missing", detail: "No tool call" }],
      })
    );

    expect(parsed.output).toBeTruthy();
    expect(parsed.output?.pass).toBe(false);
  });

  it("rejects invalid JSON", () => {
    const parsed = parseJudgeOutput("not json");
    expect(parsed.output).toBeNull();
    expect(parsed.error).toMatch(/Invalid JSON/);
  });

  it("builds fallback failures", () => {
    const result = buildJudgeFailure("trace-1", "bad output");
    expect(result.status).toBe("fail");
    expect(result.cluster).toBe("Invalid judge response");
  });
});
