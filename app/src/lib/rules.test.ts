import { describe, expect, it } from "vitest";
import { evaluateTrace, parseRules } from "@/lib/rules";
import type { Trace } from "@/lib/types";

describe("parseRules", () => {
  it("parses a basic rule", () => {
    const rules = parseRules(`rules:\n  - id: refund\n    when: user_requests(\"refund\")\n    require: tool_called(\"lookup_refund\")\n    severity: high`);

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("refund");
    expect(rules[0].severity).toBe("high");
  });

  it("rejects missing rules", () => {
    expect(() => parseRules("foo: bar")).toThrow("rules array");
  });
});

describe("evaluateTrace", () => {
  const rules = parseRules(`rules:\n  - id: refund\n    when: user_requests(\"refund\")\n    require: tool_called(\"lookup_refund\")\n    severity: high\n  - id: pii\n    when: agent_says(\"re:\\d{3}-\\d{2}-\\d{4}\")\n    action: fail\n    severity: critical`);

  it("fails when tool is missing", () => {
    const trace: Trace = {
      id: "t1",
      messages: [
        { role: "user", content: "Refund please" },
        { role: "assistant", content: "Sure" },
      ],
    };

    const evaluation = evaluateTrace(rules, trace);
    expect(evaluation.result.status).toBe("fail");
    expect(evaluation.result.severity).toBe("high");
    expect(evaluation.result.evidence[0].idx).toBe(0);
  });

  it("passes when tool requirement is satisfied", () => {
    const trace: Trace = {
      id: "t2",
      messages: [
        { role: "user", content: "refund" },
        {
          role: "tool",
          content: "ok",
          metadata: { tool_name: "lookup_refund" },
        },
      ],
    };

    const evaluation = evaluateTrace(rules, trace);
    expect(evaluation.result.status).toBe("pass");
  });

  it("flags regex-based leaks", () => {
    const trace: Trace = {
      id: "t3",
      messages: [
        {
          role: "assistant",
          content: "SSN is 123-45-6789",
        },
      ],
    };

    const evaluation = evaluateTrace(rules, trace);
    expect(evaluation.result.status).toBe("fail");
    expect(evaluation.result.severity).toBe("critical");
  });
});
