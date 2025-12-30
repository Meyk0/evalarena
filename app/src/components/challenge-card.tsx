import Link from "next/link";
import type { ChallengeSummary } from "@/lib/types";

type ChallengeCardProps = {
  challenge: ChallengeSummary;
};

const badgeStyles = {
  Performance: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Safety: "bg-amber-50 text-amber-700 border-amber-100",
} as const;

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  return (
    <Link
      href={`/c/${challenge.id}`}
      className="group flex h-full flex-col justify-between rounded-xl border border-border bg-card/80 p-4 transition hover:-translate-y-0.5 hover:border-accent"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-medium ${badgeStyles[challenge.category]}`}
          >
            {challenge.category}
          </span>
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
            {challenge.difficulty}
          </span>
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
            {challenge.mode_label}
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {challenge.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {challenge.description}
          </p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>Pass threshold</span>
        <span className="font-semibold text-foreground">
          {Math.round(challenge.pass_threshold * 100)}%
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm font-medium text-foreground">
        <span>Start</span>
        <span className="transition group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
