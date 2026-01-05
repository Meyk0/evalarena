import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import StartChallengeButton from "@/components/start-challenge-button";

export default function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-foreground">
            EvalArena
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#challenges"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Challenges
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <StartChallengeButton
            href="#challenges"
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:opacity-90"
          >
            Pick a challenge
          </StartChallengeButton>
        </div>
      </div>
    </header>
  );
}
