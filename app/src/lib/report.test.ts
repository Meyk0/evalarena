import { describe, expect, it } from "vitest";
import { buildRedactedExcerpts, redactText } from "@/lib/report";

describe("redactText", () => {
  it("masks alphanumeric tokens", () => {
    expect(redactText("Refund ID R-1234")).toBe("Re**** ID R-1234");
  });
});

describe("buildRedactedExcerpts", () => {
  it("limits to two excerpts and redacts", () => {
    const excerpts = buildRedactedExcerpts(
      ["First secret", "Second secret", "Third secret"],
      "fallback"
    );
    expect(excerpts).toHaveLength(2);
    expect(excerpts[0]).toContain("Fi***");
  });
});
