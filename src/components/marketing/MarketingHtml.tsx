import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Script from 'next/script';

function loadPartial(slug: string): { html: string; scripts: string[] } {
  const marketingDir = resolve(process.cwd(), 'src', 'marketing');
  const htmlPath = resolve(marketingDir, `${slug}.html`);
  const scriptsPath = resolve(marketingDir, `${slug}.scripts.json`);

  if (!existsSync(htmlPath)) {
    return {
      html: `<section class="mx-auto max-w-3xl px-6 py-24">
        <h1 class="font-display text-4xl">Marketing partial missing</h1>
        <p class="mt-4 text-muted-foreground">
          Run <code class="font-mono text-signal">npm run memory:extract</code>
          to generate <code class="font-mono">src/marketing/${slug}.html</code>
          from the source HTML at the repo root.
        </p>
      </section>`,
      scripts: [],
    };
  }

  const html = readFileSync(htmlPath, 'utf8');
  const scripts = existsSync(scriptsPath)
    ? (JSON.parse(readFileSync(scriptsPath, 'utf8')) as string[])
    : [];
  return { html, scripts };
}

export function MarketingHtml({ slug }: { slug: string }) {
  const { html, scripts } = loadPartial(slug);
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {scripts.map((body, idx) => (
        <Script
          id={`marketing-${slug}-${idx}`}
          key={`${slug}-${idx}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ))}
    </>
  );
}
