import Link from "next/link";
import type { ChallengeSummary } from "@/lib/types";

type ChallengeCardProps = {
  challenge: ChallengeSummary;
  completed?: boolean;
  devReady?: boolean;
};

const badgeStyles = {
  Performance: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Safety: "bg-amber-50 text-amber-700 border-amber-100",
} as const;

export default function ChallengeCard({
  challenge,
  completed = false,
  devReady = false,
}: ChallengeCardProps) {
  return (
    <Link
      href={`/c/${challenge.id}`}
      className="group flex h-full flex-col justify-between rounded-md border border-border bg-card/80 p-4 transition hover:border-accent hover:bg-secondary/60"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-medium ${badgeStyles[challenge.category]}`}
          >
            {challenge.category}
          </span>
          {completed ? (
            <span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
              Completed
            </span>
          ) : null}
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
            {challenge.difficulty}
          </span>
          {devReady && !completed ? (
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
              Dev ready
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {challenge.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {challenge.description}
          </p>
          {challenge.recommended_mode ? (
            <p className="text-xs text-muted-foreground">
              Recommended mode:{" "}
              <span className="font-semibold text-foreground">
                {challenge.recommended_mode === "judge"
                  ? "LLM as judge"
                  : "Deterministic rule"}
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm font-medium text-foreground">
        <span>Start</span>
        <span className="transition group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
