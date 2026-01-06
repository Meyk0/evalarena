export type ToolDefinition = {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
};

export type TraceMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
};

export type Trace = {
  id: string;
  topic?: string | null;
  messages: TraceMessage[];
};

export type ChallengeContext = {
  system_prompt: string;
  tools: ToolDefinition[];
  contract: string[];
};

export type ChallengeSummary = {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: "Performance" | "Safety";
  mode_label: "Debug baseline" | "From scratch";
  start_mode: "baseline" | "scratch";
  pass_threshold: number;
  recommended_mode?: "rules" | "judge";
  world_id?: string | null;
  world_order?: number | null;
  primer_text?: string | null;
};

export type ChallengeDetail = ChallengeSummary & {
  context: ChallengeContext;
  baseline_rules_text?: string | null;
  baseline_judge_text?: string | null;
  default_rules_text: string;
  default_judge_text: string;
  hint_rules_text?: string | null;
  hint_judge_text?: string | null;
};

export type WorldSummary = {
  id: string;
  title: string;
  description?: string | null;
  order_index: number;
  required_count: number;
};

export type RunResult = {
  traceId: string;
  status: "pass" | "fail";
  severity: "low" | "high" | "critical";
  cluster: string;
  evidence: Array<{
    idx: number;
    label: string;
    detail: string;
    level: "warn" | "bad";
  }>;
  reasoning?: string;
};

export type MetaSuggestion = {
  title: string;
  detail: string;
  insert?: string;
};

export type MetaCritique = {
  suggestions: MetaSuggestion[];
};

export type RunSummary = {
  passRate: number;
  criticalCount: number;
  ship: boolean;
};

export type TestReportItem = {
  traceId: string;
  cluster: string;
  contract_clause: string;
  redacted_evidence: string;
};

export type RunResponse = {
  results: RunResult[];
  summary: RunSummary;
  meta_critique?: MetaCritique | string;
  test_report?: TestReportItem[];
  coverage?: {
    totalRules: number;
    matchedRules: string[];
    unmatchedRules: string[];
    matchedByRule?: Record<string, string[]>;
    matchedCountsByRule?: Record<string, number>;
  };
  rubric_coverage?: {
    totalClauses: number;
    matchedClauses: string[];
    missingClauses: string[];
  };
  rubric_quality?: {
    ok: boolean;
    missing: string[];
  };
};
