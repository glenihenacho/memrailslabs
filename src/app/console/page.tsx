import Link from 'next/link';
import { MarketingHtml } from '@/components/marketing/MarketingHtml';

// Source: console.html (marketing). For the functional query/inspector UI, see /console-live.
export default function ConsolePage() {
  return (
    <>
      <div className="border-b hairline bg-graphite-2/60">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4 text-[12px] font-mono">
          <span className="text-muted-foreground">
            This page is the product walkthrough. The console runs against your local corpus.
          </span>
          <Link
            href="/console-live"
            className="inline-flex items-center gap-2 text-signal hover:opacity-90"
          >
            Try the live console →
          </Link>
        </div>
      </div>
      <MarketingHtml slug="console" />
    </>
  );
}
