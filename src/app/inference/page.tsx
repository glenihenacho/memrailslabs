import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Inference — MemRails',
  description:
    'Agents infer locally. MemRails serves a governed context bundle from the cloud — no key custody, no decryption, no local vector DB. Model-agnostic and inspectable.',
};

const STEPS = [
  {
    ref: '01',
    title: 'Ask for memory',
    code: 'memory.retrieve(task_context)',
    body: 'The local agent sends its task context and asks for memory. No keys to hand over, no database to manage, no embeddings to build — just the request.',
  },
  {
    ref: '02',
    title: 'Receive a governed bundle',
    code: '→ ContextBundle',
    body: 'Scope → policy → MemoryIndex tree reasoning → ranking runs in the cloud and returns a compact, governed context bundle: the selected memories, why each was chosen, what was omitted, and the retrieval trace.',
  },
  {
    ref: '03',
    title: 'Infer locally',
    code: 'model.run(bundle, task)',
    body: 'Your model runs on your side against the bundle. MemRails never sees your inference, never holds your model key, and never decrypts your traffic. Memory is a protocol, not a black box.',
  },
];

const PRINCIPLES = [
  ['No key custody', 'MemRails serves memory. It never takes or stores your model provider key — you infer with whatever model you choose.'],
  ['No decryption', 'The retrieval layer governs and ranks memory; it does not read or decrypt your inference traffic.'],
  ['No local vector DB', 'No embeddings to build, no index to host, no DB to operate locally. Retrieval is a hosted, governed call.'],
  ['Model-agnostic', 'Claude, OpenAI, or a local model — the context-bundle contract survives model swaps.'],
  ['Governed & inspectable', 'Every bundle carries reason_selected, omitted, and a retrieval_trace. Nothing ships as anonymous context.'],
  ['File-canonical & exportable', 'Memory stays Git-versioned and exportable. Read it, self-host it, or eject — no lock-in.'],
];

export default function InferencePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b hairline">
        <div className="absolute inset-0 grid-bg opacity-60 mask-radial-center" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-20">
          <div className="meta-bar text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            <span><span className="text-signal mr-1.5">Primitive</span>memory.retrieve()</span>
            <span><span className="text-signal mr-1.5">Inference</span>Local · agent-side</span>
            <span><span className="text-signal mr-1.5">Keys</span>Yours, never ours</span>
          </div>

          <h1 className="mt-9 font-display font-medium text-5xl md:text-7xl leading-[1.0] tracking-[-0.03em] max-w-4xl">
            Infer locally. <span className="text-gradient-signal">Retrieve memory from the cloud.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] md:text-base leading-relaxed text-muted-foreground">
            MemRails is cloud-hosted memory infrastructure for locally inferred agents. The agent
            asks for memory, receives a governed context bundle, and runs the model on its own
            side. No key handling, no decryption, no local vector DB, no database to manage.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <div className="hero-cta-cmd inline-flex items-center gap-2 h-11 px-4 rounded-md border hairline bg-graphite font-mono text-[13px]">
              <span className="text-signal">$</span>
              <span>&nbsp;npx @memrails/wizard</span>
            </div>
            <Link
              href="/mcp"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md border hairline text-sm font-medium hover:border-signal/60 hover:text-signal transition"
            >
              Wire it via MCP →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-sm shadow-signal hover:opacity-95 transition tracking-tight"
            >
              See pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div
            className="ref-eyebrow text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
            data-ref="01"
          >
            <span className="ref-rule" />
            The loop
          </div>
          <h2 className="mt-5 font-display font-medium text-3xl md:text-5xl tracking-tight max-w-3xl leading-[1.05]">
            Retrieve in the cloud, <span className="text-gradient-signal">reason on your side.</span>
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.ref}
                className="rounded-xl border hairline bg-graphite/40 p-6 shadow-card"
              >
                <div className="font-mono text-[11px] text-signal tracking-[0.18em]">{s.ref}</div>
                <h3 className="mt-3 font-display text-xl tracking-tight">{s.title}</h3>
                <code className="mt-4 block font-mono text-[12.5px] text-cyan break-words">
                  {s.code}
                </code>
                <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY LOCAL INFERENCE */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div
            className="ref-eyebrow text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
            data-ref="02"
          >
            <span className="ref-rule" />
            Why local inference
          </div>
          <h2 className="mt-5 font-display font-medium text-3xl md:text-5xl tracking-tight max-w-3xl leading-[1.05]">
            Memory as a <span className="text-gradient-signal">protocol</span>, not a black box.
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border hairline bg-border md:grid-cols-2">
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
        </div>
      </section>

      {/* THE CONTRACT */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div
            className="ref-eyebrow text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
            data-ref="03"
          >
            <span className="ref-rule" />
            The contract
          </div>
          <h2 className="mt-5 font-display font-medium text-3xl md:text-5xl tracking-tight max-w-3xl leading-[1.05]">
            One primitive. <span className="text-gradient-signal">Survives every model swap.</span>
          </h2>

          <div className="mt-10 max-w-3xl overflow-hidden rounded-xl border hairline bg-graphite shadow-card">
            <div className="flex items-center gap-2 border-b hairline px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-evidence-bad/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-evidence-warn/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-evidence-good/70" />
              <span className="ml-2">agent.ts</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
              <code>{`// The local agent asks for memory and infers on its own side.
const bundle = await memory.retrieve(taskContext);

// bundle: ContextBundle
//   .memories        selected, ranked, scoped
//   .reason_selected why each made the cut
//   .omitted         what was deliberately left out
//   .retrieval_trace scope → policy → MemoryIndex → ranking

const answer = await model.run({ context: bundle, task });
// MemRails never sees \`answer\`, never holds your key.`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* SIMPLE API */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div
            className="ref-eyebrow text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
            data-ref="04"
          >
            <span className="ref-rule" />
            Simple API
          </div>
          <h2 className="mt-5 font-display font-medium text-3xl md:text-5xl tracking-tight max-w-3xl leading-[1.05]">
            One endpoint. <span className="text-gradient-signal">One call to governed memory.</span>
          </h2>

          <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            {/* offer copy + pricing + CTA */}
            <div>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                No SDK, no infra, no vector DB to stand up. POST your task context to a single
                endpoint and get back a governed, evidence-graded context bundle — ready for your
                local model to infer against. Model-agnostic, inspectable, ~50&nbsp;ms.
              </p>

              <ul className="mt-7 space-y-3 text-[14px]">
                {[
                  ['$0.002', 'per retrieval ($2 / 1,000) — the one metered call'],
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

              <div className="mt-8 flex flex-wrap items-center gap-3">
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
                  200 · ContextBundle
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
          </div>
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
            Point your agent at MemRails, retrieve a governed context bundle, and infer with the
            model you already trust.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/mcp"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-sm shadow-signal hover:opacity-95 transition tracking-tight"
            >
              Connect via MCP →
            </Link>
            <a
              href="https://github.com/memrails"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md border hairline text-sm font-medium hover:border-signal/60 hover:text-signal transition"
            >
              View on GitHub →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
