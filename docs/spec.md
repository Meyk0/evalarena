EvalArena MVP Spec v1.01

1. Vision and goals

EvalArena is a practice playground for learning LLM evals by doing. It is inspired by the "LeetCode for evals" idea, but optimized for real product work: generalization, regression testing, and safety.

The core belief: shipping agents is limited less by model quality and more by evaluation quality.

Strategic objectives

Teach the eval loop: Observe failures -> Author eval -> Run on Dev Set -> Ship to Prod on Hidden Test Set.

Balance safety and performance: challenges include both utility (correctness) and safety (red teaming).

Feel like a real dev tool: YAML rules, structured JSON outputs, trace-first debugging.

Non-goals for MVP

No progression unlock system. Users can start any challenge.

No team workflows, leaderboards, or review flows.

No general purpose eval DSL. Keep deterministic rules small and opinionated.

No large courseware system. The product is the teacher.

2. Core learning pillars

A. Dataset split (anti-overfitting)

Every challenge contains:

Public Dev Set: visible traces, used for iteration.

Private Test Set: hidden traces, used only when the user clicks "Ship to Prod".

Lesson

A perfect dev score can still fail in prod if the eval is brittle.

Product behavior

"Run" evaluates Dev Set only.

"Ship to Prod" evaluates the hidden Test Set for the active eval type.

Test Set traces are not fully shown. The user gets a redacted failure report that teaches what to generalize without handing over the full answer.

B. Agent context (ground truth)

You cannot evaluate a trace in a vacuum. The workspace shows:

Agent persona (system prompt)

Tool manifest (tool names and JSON schemas)

Contract (must-dos and must-nots)

These define ground truth for both deterministic rules and judge rubrics.

C. Judge the judge (anti-black-box)

When using LLM-as-judge, EvalArena provides a meta-evaluation.

Meta-judge behavior

A strong reasoning model critiques the user rubric against the contract.

It flags vagueness and missing criteria and warns about high variance.

Example feedback

"This rubric does not define what counts as evidence for refund status. Expect inconsistent scoring."

3. Product

EvalArena is a practice sandbox for learning evals. Users pick a realistic agent challenge (support and safety), author an evaluation (deterministic rules or LLM-as-judge rubric), run it on Dev Set, then ship to a hidden Test Set.

The spec defines MVP behavior, data models, API contracts, and build order.

4. Target user

PMs and engineers who want to level up on evals.

Technical enough to edit YAML and prompts.

5. Core loop

Pick a challenge

Inspect agent context, contract, and trace

Author an eval in the active tab only

Run on Dev Set

Inspect failures with highlights, evidence, and diff

Iterate until Dev Set is strong

Ship to Prod and validate on Hidden Test Set

Mark challenge completed when Hidden Test Set passes

Progress states

Dev ready: the latest Dev Set run meets the ship criteria

Prod ready: the latest Hidden Test Set run meets the ship criteria

Challenge completion uses Prod ready (Hidden Test Set pass)

6. Pages and UX

Page 1: Challenge Library (/)

Purpose: choose a scenario quickly.

Requirements

Search

Each card shows:

challenge id, title, category, difficulty

mode label: Debug baseline vs From scratch

completion state (local storage)

CTA: Start (opens workspace)

State (MVP)

Progress stored locally:

key: evalarena_progress_v1

value:

completedChallengeIds: string[] (Prod ready)

devReadyChallengeIds: string[] (optional, for UI badges)

Notes

Users can start any challenge at any time.

The library can show two badges:

Dev ready

Completed

Page 2: Workspace (/c/:challengeId)

Purpose: run the full loop.

Layout

3-pane workspace with independent scrolling regions

Context and trace

Eval editor

Results and regression diff

Pane 1: Context and trace

Ticket selector for Dev Set traces

Agent context (collapsible)

System prompt

Tool manifest (names and JSON schemas)

Contract panel

Must-dos and must-nots

Transcript viewer

Role badges and message bubbles

Tool calls rendered with tool name and key fields

Evidence highlighting after runs

Pane 2: Eval editor

Tabs

Deterministic rule (YAML)

LLM as judge (rubric prompt)

Run executes only the active tab

Reveal hint (collapsible)

action: Insert skeleton

hint is partial with TODOs, never a full solution

Pane 3: Results and regression diff

Primary actions

Run (Dev Set)

Ship to Prod (Hidden Test Set)

Run summary

pass rate

critical count

release gate: Ready vs Blocked

Regression view (diff vs previous run)

Fixed ✅

Regressed ❌

New fail ⚠️

Misses list

click to jump to the trace and scroll transcript

Test Set failure report

Test traces are not fully shown.

The backend evaluates hidden traces and returns a redacted report:

cluster label

violated contract clause

1 to 2 redacted message excerpts with tokens masked (balanced redaction)

meta-judge critique (judge mode only)

Rate limiting

Ship to Prod is unlimited in MVP.

Recommended: add a simple server-side throttle later to control spend if needed.

6.1 Design system and visual style

EvalArena should look and feel like a minimal shadcn style dev tool.

Design principles

Clarity over decoration: use spacing, borders, and typographic hierarchy instead of heavy shadows.

Consistency: the same components and patterns everywhere (cards, tabs, badges, lists).

Fast scanning: make it easy to spot misses, regressions, and evidence.

Typography

Use a single font family across the product (recommended: shadcn default font-sans).

Limit to 3 text sizes:

Small: metadata and helper text (text-sm)

Base: primary reading text (text-base)

Large: page titles and section headers (text-xl)

Prefer font weight for hierarchy (normal, medium, semibold) rather than adding more sizes.
Spacing and component tokens

Base spacing scale uses an 8px grid.

Standard paddings:

Page padding: p-6

Pane padding: p-4

Card padding: p-4 (dense cards can use p-3)

Editor padding: p-3 inside the editor surface

Standard gaps:

Between panes: gap-4

Within sections: space-y-3

Dense lists: space-y-2

Standard heights:

Control height: 40px (Tailwind h-10)

Small button height: 32px (Tailwind h-8)

Borders and radii:

Use border and rounded-xl by default

Avoid mixed radius values across components

Shadows:

Default none

If needed, allow shadow-sm only

Color

Keep the palette to 2 to 3 colors plus neutrals:

Neutral background and foreground (shadcn background, foreground, muted)

One accent color for primary actions and selection state: Indigo

One status color family for success and danger (optional, can be implemented as subtle tinted backgrounds)

Indigo usage guidelines

Primary buttons and focused states use indigo.

Avoid using indigo for large surfaces.

Tailwind examples:

primary button: bg-indigo-600 text-white hover:bg-indigo-700

focus ring: ring-2 ring-indigo-500

selected row: bg-indigo-50 (or a subtle indigo tinted background)

links: text-indigo-600 hover:text-indigo-700

Use color sparingly, mainly for:

Primary CTA (Run, Ship to Prod)

Status badges (Ready, Blocked)

Diff icons (Fixed, Regressed, New fail)

Evidence highlights in transcript

Shadows and surfaces

Prefer borders and subtle background contrast.

If shadows are used, keep to shadow-sm only, or avoid entirely.

Component guidance (shadcn and Tailwind)

Use:

Card, Tabs, Button, Badge, Separator

Collapsible (for Agent context and Reveal hint)

ScrollArea (for transcript and results lists)

Textarea (editor)

Tooltip (optional, for explaining diff icons)

Roundness: consistent radius (for example rounded-xl or rounded-2xl).

Icons: minimal, consistent set (for example lucide icons) and only where they add meaning.

Layout rules

3-pane workspace should keep stable widths and independent scrolling regions:

Context and trace: scroll transcript

Editor: scroll editor content

Results: scroll miss list and diff

Keep all primary actions in one row:

Run (Dev Set)

Ship to Prod (Hidden Test Set)

Always show the active mode clearly (Deterministic rule vs LLM as judge).

Accessibility

Ensure contrast is sufficient for muted text and evidence highlights.

Keyboard focus states should be visible and consistent.

7. Challenge model

A challenge is a practice unit with:

agent context

dev_set traces (visible)

test_set traces (hidden)

a starting state

Debug baseline: prefilled eval scaffold that is wrong or incomplete

From scratch: empty eval

pass threshold (default 0.85)

Notes

pass_threshold applies to both Dev Set and Hidden Test Set.

Performance challenges can also contain critical failures (for example unverified financial actions).

Categories

Performance: correctness, tool verification, policy adherence

Safety: prompt injection, secret collection, internal leakage

8. Data models

ToolDefinition

TypeScript

type ToolDefinition = {
  name: string;
  description?: string;
  input_schema: Record<string, any>;  // JSON Schema
  output_schema?: Record<string, any>;
};

TraceMessage

type TraceMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: any; // tool call payloads, tool name, ids
};

Trace

type Trace = {
  id: string;
  messages: TraceMessage[];
  hidden_fail_reason?: string; // for authoring and seed generation only
};

Challenge

type Challenge = {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: "Performance" | "Safety";
  mode_label: "Debug baseline" | "From scratch";
  start_mode: "baseline" | "scratch";
  pass_threshold: number; // default 0.85
  context: {
    system_prompt: string;
    tools: ToolDefinition[];
    contract: string[]; // must-dos and must-nots
  };
  dev_set: Trace[];
  test_set: Trace[]; // hidden to user
  baseline_rules_text?: string;
  baseline_judge_text?: string;
  default_rules_text: string;
  default_judge_text: string;
  hint_rules_text?: string;
  hint_judge_text?: string;
};

9. Deterministic rules (YAML)

Goals

Fast, exact checks

Grounding agent claims in tool traces

Simple safety pattern detection

Format

YAML with top-level key rules.

Rule fields

id: string

when: condition

require?: requirement

action?: fail

severity: low | high | critical

notes?: string

Conditions (MVP, constrained)

agent_says(pattern)

user_requests(pattern)

Requirements

tool_called(toolNames)

Pattern semantics

Default: plain case-insensitive substring match.

Regex is supported only when explicitly requested with the re: prefix.

Example: agent_says("re:\d{3}-\d{2}-\d{4}")

Goal

Avoid YAML escaping pain for beginners while still allowing regex when needed.

Example

rules:
  - id: pii_leak_check
    when: agent_says("re:\d{3}-\d{2}-\d{4}")
    severity: critical
    action: fail

  - id: refund_validation
    when: user_requests("refund")
    require: tool_called("process_refund")
    severity: high
    notes: "Agent must trigger the refund tool if the user asks."

Evaluation semantics

Match agent_* only on assistant messages.

Match user_* only on user messages.

tool_called matches tool messages by tool name in metadata.

Evidence mapping

Evidence points at the triggering message idx.

Detail explains what matched and what requirement was missing.

10. LLM as judge

Goals

Teach rubric writing and calibration

Catch semantic failures deterministic checks miss

Judge output schema

Judge must output JSON only.

MVP schema

{
  "pass": true,
  "severity": "low",
  "cluster": "short label",
  "reason": "one paragraph explanation",
  "evidence": [
    {"idx": 2, "label": "Unverified claim", "detail": "..."}
  ]
}

Validation

Invalid JSON is treated as fail with high severity and an actionable error.

Evidence is optional in MVP.

If evidence is missing, the UI should still show pass or fail, but transcript highlights will be empty.

Meta-judge (judge mode only)

Meta-judge returns a critique string.

MVP behavior

Meta-judge runs on every judge run (Dev and Test).

It checks whether the rubric references the contract, defines evidence, and avoids vague language.

Output is displayed in results and in the Hidden Test Set failure report.

11. Backend API

POST /api/run

Inputs

challenge_id: string

active_tab: rules | judge

eval_config: string

target_set: dev | test

Execution flow

Load challenge context and target traces

Parse and validate eval config

Execute runner

If judge mode, run meta-judge critique

Compute summary

Return results

Diff behavior

Diff is computed on the client by comparing the current response to the last run stored in local storage.

Reason: no-auth MVP should avoid server session state.

Response

type RunResponse = {
  results: Array<{
    traceId: string;
    status: "pass" | "fail";
    severity: "low" | "high" | "critical";
    cluster: string;
    evidence: Array<{ idx: number; label: string; detail: string; level: "warn" | "bad" }>;
    reasoning?: string;
  }>;
  summary: {
    passRate: number;
    criticalCount: number;
    ship: boolean;
  };
  meta_critique?: string;
  test_report?: Array<{
    traceId: string;
    cluster: string;
    contract_clause: string;
    redacted_evidence: string;
  }>;
};

Ship logic

For Dev Set run: ship means Dev ready.

For Hidden Test Set run: ship means Prod ready.

Default win threshold

passRate >= pass_threshold AND criticalCount === 0

12. Storage strategy (MVP)

No authentication.

Local storage

Progress

Completed challenges (Prod ready)

Optional Dev ready badges

Last edited eval per challenge and per tab

Last run response per challenge and per tab (for diff)

Recommendation for anonymous run history

MVP: keep run history in local storage only.

Later: optionally persist anonymous runs in Supabase with a random client_id to enable analytics.

Supabase usage

Store challenge content (context, dev_set, test_set, templates)

Fetch read-only from client

Note on hidden test set

Client should never fetch full test_set traces.

Backend fetches test traces server-side and returns only redacted test reports.

13. Supabase schema (recommended)

Tables

challenges

id text primary key

title text

description text

difficulty text

category text

mode_label text

start_mode text

pass_threshold numeric

context_json jsonb

baseline_rules_text text

baseline_judge_text text

default_rules_text text

default_judge_text text

hint_rules_text text

hint_judge_text text

traces

id text primary key

challenge_id text references challenges

set_type text check in ("dev","test")

topic text

messages_json jsonb

hidden_fail_reason text

Indexes

(challenge_id, set_type)

14. MVP build order

Phase 1: Data

Seed 3 challenges minimum: 1 performance, 1 safety, 1 RAG style

Phase 2: Runner

Build deterministic YAML evaluator

Phase 3: UI

Build workspace 3-pane layout

Implement diff view and transcript highlighting

Phase 4: Judge mode

Integrate judge runner and JSON validation

Phase 5: Meta-judge

Add rubric critique and show it in results

Phase 6: Ship to Prod

Hidden test run button + redacted test report

15. Open questions

How much redaction is ideal for test reports (enough to learn, not enough to overfit)

Whether to persist anonymous run history in Supabase (opt-in, later)

Whether to add a structured rule builder post MVP

Contract format: keep as a list of strings in MVP, or split into Must do and Must not arrays

Appendix A: Supabase schema.sql (MVP)

-- EvalArena MVP schema
-- Storage policy: read-only content in Supabase, no auth required for MVP.
-- Progress and run history live in localStorage.

begin;

-- Optional: if you want UUIDs later for other tables
create extension if not exists pgcrypto;

-- Challenges are the top-level units.
create table if not exists public.challenges (
  id text primary key,
  title text not null,
  description text not null,
  difficulty text not null check (difficulty in ('Easy','Medium','Hard')),
  category text not null check (category in ('Performance','Safety')),
  mode_label text not null check (mode_label in ('Debug baseline','From scratch')),
  start_mode text not null check (start_mode in ('baseline','scratch')),
  pass_threshold numeric not null default 0.85 check (pass_threshold >= 0 and pass_threshold <= 1),

  -- Context for ground truth
  context_json jsonb not null default '{}'::jsonb,

  -- Starter content for editors
  baseline_rules_text text,
  baseline_judge_text text,
  default_rules_text text not null default '',
  default_judge_text text not null default '',
  hint_rules_text text,
  hint_judge_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.challenges is 'EvalArena challenges. Contains context, templates, and thresholds.';
comment on column public.challenges.context_json is 'JSON with system_prompt, tools, and contract list.';

-- Traces belong to a challenge and are split into dev and test.
create table if not exists public.traces (
  id text primary key,
  challenge_id text not null references public.challenges(id) on delete cascade,
  set_type text not null check (set_type in ('dev','test')),
  topic text,

  -- Trace messages, including tool metadata
  messages_json jsonb not null,

  -- For authoring only. Do not return this to clients.
  hidden_fail_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.traces is 'Trace data for challenges. set_type controls dev vs hidden test.';

create index if not exists traces_challenge_set_idx on public.traces (challenge_id, set_type);
create index if not exists traces_challenge_idx on public.traces (challenge_id);

-- Minimal updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_challenges_updated_at on public.challenges;
create trigger trg_challenges_updated_at
before update on public.challenges
for each row execute function public.set_updated_at();

drop trigger if exists trg_traces_updated_at on public.traces;
create trigger trg_traces_updated_at
before update on public.traces
for each row execute function public.set_updated_at();

commit;

-- RLS note
-- For MVP, you can keep RLS disabled and use a Supabase anon key with select-only policies.
-- If you enable RLS, add policies like:
--   create policy "read challenges" on public.challenges for select using (true);
--   create policy "read dev traces" on public.traces for select using (set_type = 'dev');
-- and ensure test traces are only fetched server-side.

Appendix B: Concrete UI component map (shadcn)

This maps each screen and section to shadcn components with the minimal style constraints in this spec.

Global

Shell layout

Container: div with p-6 and max-w-[1400px] mx-auto

Typography: font-sans, text-sm, text-base, text-xl

Surfaces: border, rounded-xl, no shadow by default

Navigation

Top bar: Card or div with border-b

Page title: text-xl font-semibold

/ Challenge Library

Search

Input with h-10 and a left icon (optional)

Filters (optional)

Tabs or Select

Challenge list

Card per challenge

Inside card:

Header row: Badge for category and difficulty

Title: text-base font-semibold

Description: text-sm text-muted-foreground

Footer row:

Status badges: Badge with variants for Dev ready and Completed

Primary action: Button (indigo) "Start"

/c/:challengeId Workspace

3-pane grid

Layout: div with grid grid-cols-12 gap-4

Pane 1: col-span-4

Pane 2: col-span-4

Pane 3: col-span-4

Each pane is a Card with p-4 and an internal ScrollArea.

Pane 1: Context and trace

Ticket selector

Select or Tabs (if always small)

Agent context

Collapsible

Section 1: System prompt (monospace block)

Section 2: Tool manifest (json view)

Contract

Card inside pane or Separator blocks

Render as list with text-sm

Transcript

ScrollArea

Message bubble component (custom)

Uses Badge for role

Uses subtle borders

Evidence highlight styles:

warn: bg-amber-50 border-amber-200

bad: bg-red-50 border-red-200

Pane 2: Eval editor

Mode tabs

Tabs with two triggers:

Deterministic rule

LLM as judge

Editor

Textarea for MVP

Monospace styling: font-mono text-sm leading-5

Reveal hint

Collapsible

Button: Button variant="ghost" size="sm" labeled "Reveal hint"

Insert skeleton: Button size="sm" secondary

Pane 3: Results and diff

Primary actions row

Button (indigo) "Run" (Dev)

Button variant="outline" "Ship to Prod" (Hidden)

Summary

Badge for Ready vs Blocked

Badge for pass rate and critical count

Diff view

Card section with three counters:

Fixed ✅ (lucide CheckCircle2)

Regressed ❌ (lucide XCircle)

New fail ⚠️ (lucide AlertTriangle)

Misses list

ScrollArea

Each miss is a clickable row:

Button variant="ghost" wrapping a small layout

Left: trace id and cluster

Right: severity badge

Buttons and accent usage

Indigo is reserved for the main primary action on each screen.

Secondary actions use outline or ghost.

Minimal icon set (lucide)

Start: Play

Run: Play

Ship: Rocket

Ready: CheckCircle2

Blocked: XCircle

New fail: AlertTriangle

Suggested component files

components/challenge-card.tsx

components/message-bubble.tsx

components/trace-viewer.tsx

components/eval-editor.tsx

components/results-panel.tsx

components/diff-summary.tsx

lib/storage.ts (localStorage helpers)

lib/diff.ts (diff computation)

Appendix C: Supabase RLS policies (recommended)

Goal

Client (anon key) can read challenges and dev traces only.

Client cannot read test traces.

Server routes use service role key to read test traces.

-- Enable RLS
alter table public.challenges enable row level security;
alter table public.traces enable row level security;

-- Challenges: readable by anyone
create policy "read challenges" on public.challenges
for select
using (true);

-- Traces: readable by anyone only for dev set
create policy "read dev traces" on public.traces
for select
using (set_type = 'dev');

-- Optional hardening: disallow all writes from anon
-- (service role bypasses RLS, so keep service role server-side only)
create policy "no inserts" on public.challenges
for insert
with check (false);
create policy "no updates" on public.challenges
for update
using (false);
create policy "no deletes" on public.challenges
for delete
using (false);

create policy "no inserts" on public.traces
for insert
with check (false);
create policy "no updates" on public.traces
for update
using (false);
create policy "no deletes" on public.traces
for delete
using (false);

Operational notes

Never expose the service role key to the browser.

The Next.js API route POST /api/run should use the service role key only when target_set = test.

The browser should use the anon key for everything else.

