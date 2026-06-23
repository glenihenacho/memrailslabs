import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-6 text-[12px] font-mono text-muted-foreground">
        <div className="md:col-span-4">
          <div
            className="font-display font-medium text-lg tracking-tight mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            memrails<span className="text-signal">.</span>
          </div>
          <p
            className="text-[11px] leading-relaxed max-w-xs"
            style={{ color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)' }}
          >
            Knowledge density infrastructure for agentic software. Built for teams that treat memory as a protocol,
            not a vendor lock-in.
          </p>
        </div>
        <div className="md:col-span-3">
          <div
            className="text-[10px] uppercase tracking-[0.22em] mb-4"
            style={{ color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)' }}
          >
            Product
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href="/#memory" className="hover:text-foreground transition">Memory</Link>
            <Link href="/harness" className="hover:text-foreground transition">Harness</Link>
            <Link href="/console" className="hover:text-foreground transition">Console</Link>
            <Link href="/streaming" className="hover:text-foreground transition">Streaming</Link>
            <Link href="/mcp" className="hover:text-foreground transition">MCP</Link>
            <Link href="/pricing" className="hover:text-foreground transition">Pricing</Link>
            <Link href="/inference" className="hover:text-foreground transition">Inference</Link>
          </div>
        </div>
        <div className="md:col-span-2">
          <div
            className="text-[10px] uppercase tracking-[0.22em] mb-4"
            style={{ color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)' }}
          >
            Resources
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href="/#research" className="hover:text-foreground transition">Research</Link>
            <Link href="/#blog" className="hover:text-foreground transition">Blog</Link>
            <Link href="/docs" className="hover:text-foreground transition">Docs</Link>
            <Link href="/#community" className="hover:text-foreground transition">Community</Link>
          </div>
        </div>
        <div className="md:col-span-3">
          <div
            className="text-[10px] uppercase tracking-[0.22em] mb-4"
            style={{ color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)' }}
          >
            Office of Record
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-foreground">press@memrails.dev</span>
            <span>For partnership &amp; institutional inquiry.</span>
            <span className="mt-2">San Francisco · New York</span>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t hairline flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>© 2026 MemRails Labs</span>
          <span className="h-3 w-px bg-border" />
          <span>All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground transition">Privacy</a>
          <a href="#" className="hover:text-foreground transition">Terms</a>
          <a href="#" className="hover:text-foreground transition">Security</a>
          <span className="h-3 w-px bg-border hidden md:inline-block" />
          <span className="text-[10px] tracking-[0.18em] uppercase">
            Build · <span className="text-signal">v0.1</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
