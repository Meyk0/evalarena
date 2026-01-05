const sections = [
  {
    title: "Why evals matter",
    body: [
      "Evals are your test suite for model behavior, not just accuracy metrics.",
      "They turn vague quality goals into concrete pass/fail checks.",
      "A model that passes strong evals is safer to ship and easier to improve.",
    ],
  },
  {
    title: "The three gulfs",
    body: [
      "Specification: what you asked the model to do vs. what it actually does.",
      "Comprehension: more outputs than you can manually review.",
      "Generalization: the model breaks on new topics or phrasing.",
    ],
  },
  {
    title: "Analyze → Measure → Improve",
    body: [
      "Analyze real traces to find recurring failure modes.",
      "Measure those failures with explicit rules or judge rubrics.",
      "Improve the model or prompt, then re-run evals to verify.",
    ],
  },
  {
    title: "Error analysis checklist",
    body: [
      "Collect representative traces that cover real user variation.",
      "Open-code failures before deciding on eval criteria.",
      "Group failures into a clear taxonomy and prioritize by impact.",
    ],
  },
  {
    title: "Rules vs. LLM judge",
    body: [
      "Use deterministic rules for clear, mechanical requirements.",
      "Use LLM judges for nuance: tone, policy, relevance, correctness.",
      "Keep outputs binary: pass/fail with evidence tied to the trace.",
    ],
  },
  {
    title: "Strong rubric essentials",
    body: [
      "State explicit fail conditions tied to the contract.",
      "Define scope: when the rule applies and when it doesn’t.",
      "Require evidence that points to the exact message turn.",
    ],
  },
];

const sources = [
  {
    label: "Mastering LLM Evaluations guide (source document)",
    href: "https://www.zenml.io/blog/the-annotated-guide-to-the-maven-evals-course-by-way-of-the-llmops-database",
  },
  {
    label: "Hamel & Shreya LLM evals course notes",
    href: "https://thingsithinkithink.blog/posts/2025/06-08-llm-evals-lesson-1/",
  },
  {
    label: "LLM Evals FAQ",
    href: "https://hamel.dev/blog/posts/evals-faq/",
  },
];

export default function PlaybookPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Eval playbook
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-foreground">
          Master the eval loop
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          A short, practical guide to building evals that generalize beyond the
          traces you see.
        </p>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-foreground">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {section.body.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-secondary/70 p-6 text-sm text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Sources
          </p>
          <ul className="mt-3 space-y-2">
            {sources.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-dotted underline-offset-4"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
