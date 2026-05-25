import { LiveConsole } from '@/components/console/LiveConsole';

export const dynamic = 'force-dynamic';

export default function ConsoleLivePage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div
        className="ref-eyebrow text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
        data-ref="00"
      >
        <span className="ref-rule" />
        Live console
      </div>
      <h1 className="mt-5 font-display font-medium text-3xl md:text-5xl tracking-tight max-w-3xl leading-[1.05]">
        Run a query, watch the <span className="text-gradient-signal">retrieval stack.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        Every query routes through L1 → L5. The packet, the resolved layer, the evidence weights, and
        the input/output hashes are all inspectable.
      </p>
      <LiveConsole />
    </section>
  );
}
