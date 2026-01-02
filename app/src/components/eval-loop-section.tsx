"use client";

import { useState } from "react";

export default function EvalLoopSection() {
  const [mode, setMode] = useState<"debug" | "ship">("debug");

  return (
    <section id="how-it-works" className="border-t border-border py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-accent">
                Eval loop
              </span>
              <h2 className="text-2xl font-semibold text-foreground">
                Debug before you ship
              </h2>
              <p className="mt-2 max-w-lg text-muted-foreground">
                Use visible traces to tune the eval, then prove it holds up on
                hidden tests.
              </p>
            </div>

            <div className="flex items-center">
              <div className="flex items-center rounded-full border border-border bg-secondary p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setMode("debug")}
                  className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
                    mode === "debug"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Debug
                </button>
                <div className="mx-1 h-0.5 w-16 bg-border" />
                <button
                  type="button"
                  onClick={() => setMode("ship")}
                  className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
                    mode === "ship"
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Ship
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
