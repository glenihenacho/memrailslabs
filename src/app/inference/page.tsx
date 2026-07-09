import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Inference — MemRails',
  description:
    'One API call returns a governed, evidence-graded context bundle your local model infers against. No infra, no key custody, model-agnostic and inspectable.',
};

const PRINCIPLES: [string, string][] = [
  [
    'Memory as a protocol',
    'A typed context-bundle contract — model-agnostic, so it survives every model swap.',
  ],
  [
    'Governed & inspectable',
    'Every bundle carries reason_selected, provenance, and a retrieval_trace. Nothing ships as anonymous context; read-only by default.',
  ],
  [
    'Yours, exportable',
    'File-canonical and Git-versioned. No key custody, no local vector DB — read it out or eject anytime.',
  ],
];

/** Inference marketing page — one simple API for governed memory. */
export default function InferencePage() {
  return (
    <>
      {/* HERO — the one-API offer */}
      <section className="relative overflow-hidden border-b hairline">
        <div className="absolute inset-0 grid-bg opacity-60 mask-radial-center" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-20">
          <div className="meta-bar text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            <span><span className="text-signal mr-1.5">Primitive</span>memory.retrieve()</span>
            <span><span className="text-signal mr-1.5">Inference</span>Local · agent-side</span>
            <span><span className="text-signal mr-1.5">Keys</span>Yours, never ours</span>
          </div>

          <h1 className="mt-9 font-display font-medium text-5xl md:text-7xl leading-[1.0] tracking-[-0.03em] max-w-4xl">
            One API for <span className="text-gradient-signal">governed memory.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] md:text-base leading-relaxed text-muted-foreground">
            Drop a single endpoint into your agent loop. Behind it, MemRails runs the whole
            retrieval stack — scope, policy, the MemoryIndex tree, ranking — and returns a governed,
            evidence-graded context bundle, with provenance and optional packets, for your local
            model to infer against. You orchestrate nothing; it stays model-agnostic and inspectable.
          </p>

          {/* behind the one call */}
          <div className="mt-8 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="rounded border border-signal/40 bg-signal/5 px-2.5 py-1 text-signal">task_context</span>
            {['scope', 'policy', 'MemoryIndex tree', 'ranking'].map((s) => (
              <span key={s} className="flex items-center gap-2">
                <span className="text-signal">→</span>
                <span className="rounded border hairline bg-graphite/40 px-2.5 py-1 text-muted-foreground">{s}</span>
              </span>
            ))}
            <span className="text-signal">→</span>
            <span className="rounded border border-signal/40 bg-signal/5 px-2.5 py-1 text-signal">ContextBundle</span>
          </div>

          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            read-only by default · cheap filters first · compression as last resort
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-sm shadow-signal hover:opacity-95 transition tracking-tight"
            >
              Get an API key →
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md border hairline text-sm font-medium hover:border-signal/60 hover:text-signal transition"
            >
              API reference →
            </Link>
          </div>
        </div>
      </section>

      {/* THE OFFER — one call, the response, the price */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-7xl px-6 py-20 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* request + response */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border hairline bg-graphite shadow-card">
              <div className="flex items-center gap-2 border-b hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Request
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
                <code>{`curl -s https://memrails.dev/api/memory/retrieve \\
  -H "Authorization: Bearer $MEMRAILS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "task_context": "deploying the billing worker",
        "max_tokens": 1200 }'`}</code>
              </pre>
            </div>

            <div className="overflow-hidden rounded-xl border hairline bg-graphite shadow-card">
              <div className="flex items-center gap-2 border-b hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-evidence-good" />
                200 · ContextBundle excerpt
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
                <code>{`{
  "retrieval_id": "ret_9f2a…",
  "memories": [
    { "memory_id": "mem_4c1…",
      "summary": "Billing worker runs on cron, not the request path",
      "reason_selected": "names the billing worker + deploy",
      "score": 8.4 }
  ],
  "omitted": [{ "memory_id": "mem_77b…", "reason": "below confidence floor" }],
  "tokens_returned": 240,
  "usage": { "billable_retrievals": 1, "credits_remaining": 2499 }
}`}</code>
              </pre>
            </div>
          </div>

          {/* price */}
          <div className="lg:pt-2">
            <h2 className="font-display font-medium text-2xl md:text-3xl tracking-tight">
              One metered call. <span className="text-gradient-signal">No infra to run.</span>
            </h2>
            <ul className="mt-6 space-y-3 text-[14px]">
              {[
                ['$0.002', 'per retrieval ($2 / 1,000) — the one billable call'],
                ['Free', 'retrieval credits to start — no card, no quota'],
                ['$0', 'for writes — you pay for retrieval, nothing else'],
                ['No', 'seats, no infra, no keys to hand over'],
              ].map(([k, v]) => (
                <li key={v} className="flex items-baseline gap-3">
                  <span className="font-mono text-signal font-semibold whitespace-nowrap min-w-[3.5rem]">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-sm shadow-signal hover:opacity-95 transition tracking-tight"
              >
                Get an API key →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRINCIPLES — compact */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-7xl px-6 py-16 grid gap-px overflow-hidden rounded-xl md:grid-cols-3 bg-border">
          {PRINCIPLES.map(([title, body]) => (
            <div key={title} className="bg-background p-6">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-signal" />
                <h3 className="font-display text-lg tracking-tight">{title}</h3>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50 mask-radial-bottom" />
        <div className="relative mx-auto max-w-7xl px-6 py-28 text-center">
          <h2 className="font-display font-medium text-4xl md:text-6xl tracking-tight max-w-3xl mx-auto leading-[1.05]">
            Keep inference local. <span className="text-gradient-signal">Make memory governed.</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-muted-foreground">
            One call returns a governed context bundle; you infer with the model you already trust.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-sm shadow-signal hover:opacity-95 transition tracking-tight"
            >
              Get an API key →
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md border hairline text-sm font-medium hover:border-signal/60 hover:text-signal transition"
            >
              Read the docs →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
