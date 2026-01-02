import ChallengeLibrary from "@/components/challenge-library";
import HeroSection from "@/components/hero-section";
import LandingHeader from "@/components/landing-header";
import OutcomesSection from "@/components/outcomes-section";
import { createBrowserClient } from "@/lib/supabase/browser";
import type { ChallengeSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getChallenges(): Promise<ChallengeSummary[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("challenges")
    .select(
      "id, title, description, difficulty, category, mode_label, start_mode, pass_threshold, recommended_mode"
    )
    .order("title", { ascending: true });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("recommended_mode")) {
      const fallback = await supabase
        .from("challenges")
        .select(
          "id, title, description, difficulty, category, mode_label, start_mode, pass_threshold"
        )
        .order("title", { ascending: true });

      return (fallback.data ?? []) as ChallengeSummary[];
    }

    return [];
  }

  return (data ?? []) as ChallengeSummary[];
}

export default async function Home() {
  const challenges = await getChallenges();

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="pt-20">
        <HeroSection />
        <OutcomesSection />
        <ChallengeLibrary challenges={challenges} />
      </main>
    </div>
  );
}
