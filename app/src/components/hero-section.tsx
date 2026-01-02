import { ArrowRightIcon, PlayIcon } from "@/components/landing-icons";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-[oklch(0.55_0.25_270/0.08)] blur-3xl animate-pulse-glow" />
        <div
          className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-[oklch(0.55_0.22_290/0.05)] blur-3xl animate-pulse-glow"
          style={{ animationDelay: "1.5s" }}
        />
        <div className="absolute inset-0 landing-grid" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-muted-foreground">
            Training ground for AI evals
          </span>
        </div>

        <h1 className="max-w-4xl text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Build evaluation guardrails{" "}
          <span className="text-gradient">you can trust</span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Pick a scenario, tune the rubric or rules, and validate against hidden
          regressions. Write evals that catch model mistakes—even when the
          model looks good.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href="#challenges"
            className="flex h-12 items-center rounded-md bg-accent px-8 text-base font-medium text-accent-foreground shadow-lg shadow-[oklch(0.55_0.25_270/0.2)] transition hover:opacity-90"
          >
            Pick a challenge
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </a>
          <a
            href="#how-it-works"
            className="flex h-12 items-center rounded-md border border-border bg-card px-6 text-base font-medium text-foreground transition hover:bg-secondary"
          >
            <PlayIcon className="mr-2 h-4 w-4" />
            How it works
          </a>
        </div>

        <div className="mt-20 w-full max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-1 shadow-xl shadow-[oklch(0.55_0.25_270/0.08)]">
            <div className="rounded-xl bg-secondary/40 p-6">
              <div className="mb-4 text-center">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Eval Loop Preview
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Context", tone: "bg-muted" },
                  { label: "Eval", tone: "bg-accent/20" },
                  { label: "Results", tone: "bg-muted" },
                ].map((pane) => (
                  <div
                    key={pane.label}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {pane.label}
                      </span>
                      <span className="h-2 w-2 rounded-full bg-accent/60" />
                    </div>
                    <div className="space-y-2">
                      <div className={`h-2 w-full rounded ${pane.tone} animate-shimmer`} />
                      <div
                        className={`h-2 w-3/4 rounded ${pane.tone} animate-shimmer`}
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className={`h-2 w-5/6 rounded ${pane.tone} animate-shimmer`}
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 shadow-sm">
                <span className="text-sm text-muted-foreground">Debug</span>
                <ArrowRightIcon className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Ship</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  • Visible traces first, hidden tests after.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
