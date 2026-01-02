import Link from "next/link";
import { ArrowRightIcon } from "@/components/landing-icons";
import type { ChallengeSummary } from "@/lib/types";

type ChallengeCardProps = {
  challenge: ChallengeSummary;
  completed?: boolean;
  devReady?: boolean;
};

const categoryStyles = {
  Performance: "border-indigo-400/50 text-indigo-600 bg-indigo-50",
  Safety: "border-amber-400/50 text-amber-600 bg-amber-50",
} as const;

const difficultyStyles = {
  Easy: "border-emerald-400/50 text-emerald-600 bg-emerald-50",
  Medium: "border-amber-400/50 text-amber-600 bg-amber-50",
  Hard: "border-rose-400/50 text-rose-600 bg-rose-50",
} as const;

export default function ChallengeCard({
  challenge,
  completed = false,
  devReady = false,
}: ChallengeCardProps) {
  return (
    <Link
      href={`/c/${challenge.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-[oklch(0.55_0.25_270/0.08)]"
    >
      <div className="flex flex-wrap gap-2 p-5 pb-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${categoryStyles[challenge.category]}`}
        >
          {challenge.category}
        </span>
        {completed ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
            Completed
          </span>
        ) : null}
        {devReady && !completed ? (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
            Dev ready
          </span>
        ) : null}
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${difficultyStyles[challenge.difficulty]}`}
        >
          {challenge.difficulty}
        </span>
      </div>

      <div className="flex-1 px-5 pb-4">
        <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
          {challenge.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {challenge.description}
        </p>
        {challenge.recommended_mode ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Recommended mode:{" "}
            <span className="font-medium text-foreground">
              {challenge.recommended_mode === "judge"
                ? "LLM as judge"
                : "Deterministic rule"}
            </span>
          </p>
        ) : null}
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          <span>Start</span>
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
