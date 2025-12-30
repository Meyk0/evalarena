import { notFound } from "next/navigation";
import Workspace from "@/components/workspace";
import { createBrowserClient } from "@/lib/supabase/browser";
import type { ChallengeDetail, Trace } from "@/lib/types";

export const dynamic = "force-dynamic";

type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: "Performance" | "Safety";
  mode_label: "Debug baseline" | "From scratch";
  start_mode: "baseline" | "scratch";
  pass_threshold: number;
  context_json: ChallengeDetail["context"] | null;
  baseline_rules_text?: string | null;
  baseline_judge_text?: string | null;
  default_rules_text: string;
  default_judge_text: string;
  hint_rules_text?: string | null;
  hint_judge_text?: string | null;
};

type TraceRow = {
  id: string;
  topic?: string | null;
  messages_json: Trace["messages"];
};

async function getChallengeData(challengeId: string) {
  const supabase = createBrowserClient();

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select(
      "id, title, description, difficulty, category, mode_label, start_mode, pass_threshold, context_json, baseline_rules_text, baseline_judge_text, default_rules_text, default_judge_text, hint_rules_text, hint_judge_text"
    )
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return null;
  }

  const { data: traces, error: traceError } = await supabase
    .from("traces")
    .select("id, topic, messages_json")
    .eq("challenge_id", challengeId)
    .eq("set_type", "dev")
    .order("id", { ascending: true });

  if (traceError || !traces) {
    return null;
  }

  const challengeRow = challenge as ChallengeRow;
  const challengeDetail: ChallengeDetail = {
    ...challengeRow,
    context: challengeRow.context_json ?? {
      system_prompt: "",
      tools: [],
      contract: [],
    },
  };

  const devTraces: Trace[] = (traces as TraceRow[]).map((trace) => ({
    id: trace.id,
    topic: trace.topic ?? null,
    messages: trace.messages_json || [],
  }));

  return { challenge: challengeDetail, traces: devTraces };
}

export default async function ChallengeWorkspace({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  const data = await getChallengeData(challengeId);

  if (!data) {
    notFound();
  }

  return <Workspace challenge={data.challenge} traces={data.traces} />;
}
