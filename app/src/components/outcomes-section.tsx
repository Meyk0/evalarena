import {
  FileCheckIcon,
  RocketIcon,
  ShieldIcon,
} from "@/components/landing-icons";

const outcomes = [
  {
    title: "Catches regressions",
    description: "Hidden tests reveal unseen failures before you ship.",
    Icon: ShieldIcon,
  },
  {
    title: "Enforces contracts",
    description: "Tie every rule or rubric back to the contract clauses.",
    Icon: FileCheckIcon,
  },
  {
    title: "Ships safely",
    description: "Only clean runs unlock the Ship step.",
    Icon: RocketIcon,
  },
];

export default function OutcomesSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {outcomes.map(({ title, description, Icon }) => (
            <div
              key={title}
              className="group rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-[oklch(0.55_0.25_270/0.08)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Outcome
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
