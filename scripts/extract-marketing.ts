/**
 * Extracts shared shell + per-page <main> bodies from the marketing HTML files
 * that live at the repo root, and emits them into src/marketing/ so Next.js
 * pages can hydrate them with dangerouslySetInnerHTML.
 *
 * Run: npm run memory:extract
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

type Source = { file: string; slug: string };

const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'marketing');

const SOURCES: Source[] = [
  { file: 'memrails-scroll-agent-nopricing.html', slug: 'home' },
  { file: 'harness.html', slug: 'harness' },
  { file: 'console.html', slug: 'console' },
  { file: 'mcp.html', slug: 'mcp' },
  { file: 'mpp.html', slug: 'streaming' },
  { file: 'memrails-compress.html', slug: 'compress' },
  { file: 'memrails-pricing-model-agnostic.html', slug: 'pricing' },
];

// Map original .html hrefs onto the Next.js route table.
const HREF_REWRITES: Array<[RegExp, string]> = [
  [/href="memrails-scroll-agent-nopricing\.html(#[^"]*)?"/g, 'href="/$1"'],
  [/href="index\.html(#[^"]*)?"/g, 'href="/$1"'],
  [/href="harness\.html(#[^"]*)?"/g, 'href="/harness$1"'],
  [/href="console\.html(#[^"]*)?"/g, 'href="/console$1"'],
  [/href="mcp\.html(#[^"]*)?"/g, 'href="/mcp$1"'],
  [/href="mpp\.html(#[^"]*)?"/g, 'href="/streaming$1"'],
  [/href="memrails-compress\.html(#[^"]*)?"/g, 'href="/compress$1"'],
  [/href="memrails-pricing-model-agnostic\.html(#[^"]*)?"/g, 'href="/pricing$1"'],
  [/href="pricing\.html(#[^"]*)?"/g, 'href="/pricing$1"'],
];

function rewriteHrefs(html: string): string {
  let out = html;
  for (const [pattern, replacement] of HREF_REWRITES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function extractBetween(html: string, openTag: RegExp, closeTag: string): string | null {
  const openMatch = openTag.exec(html);
  if (!openMatch) return null;
  const start = openMatch.index;
  const close = html.indexOf(closeTag, start);
  if (close === -1) return null;
  return html.slice(start, close + closeTag.length);
}

function extractMainBody(html: string): string {
  const main = extractBetween(html, /<main(\s[^>]*)?>/i, '</main>');
  if (!main) {
    throw new Error('No <main> element found');
  }
  // Strip the wrapping <main> tag — Next.js layout supplies its own.
  return main
    .replace(/^<main(\s[^>]*)?>/i, '')
    .replace(/<\/main>$/i, '')
    .trim();
}

function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[1].trim();
    if (body.length === 0) continue;
    // Skip the Tailwind config block — handled by the build-time Tailwind.
    if (body.includes('tailwind.config')) continue;
    scripts.push(body);
  }
  return scripts;
}

function isMainBodyScript(scriptBody: string, mainBody: string): boolean {
  // Heuristic: a script "belongs" to the main body if it references DOM IDs
  // that appear in the main body. The drawer toggle script references
  // #nav-drawer / #nav-toggle, which live in the layout — exclude those.
  if (scriptBody.includes('nav-drawer') || scriptBody.includes('nav-toggle')) {
    return false;
  }
  const idRefs = scriptBody.match(/getElementById\(['"]([^'"]+)['"]\)/g) || [];
  for (const ref of idRefs) {
    const id = ref.replace(/getElementById\(['"]/, '').replace(/['"]\)$/, '');
    if (mainBody.includes(`id="${id}"`)) return true;
  }
  // Catch-all: include unless it's clearly the nav-drawer IIFE.
  return !scriptBody.includes("document.getElementById('nav-drawer')");
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let wroteWordmark = false;

  for (const src of SOURCES) {
    const srcPath = join(ROOT, src.file);
    if (!existsSync(srcPath)) {
      console.warn(`! missing: ${src.file}`);
      continue;
    }
    const html = readFileSync(srcPath, 'utf8');

    // Extract logo SVG once.
    if (!wroteWordmark) {
      const svgMatch = /<svg class="logo-wordmark"[\s\S]*?<\/svg>/.exec(html);
      if (svgMatch) {
        const svgPath = join(OUT_DIR, 'wordmark.svg.html');
        writeFileSync(svgPath, svgMatch[0]);
        wroteWordmark = true;
        console.log(`  wrote ${svgPath}`);
      }
    }

    const mainBody = rewriteHrefs(extractMainBody(html));
    const allScripts = extractInlineScripts(html);
    const pageScripts = allScripts.filter((s) => isMainBodyScript(s, mainBody));

    const outPath = join(OUT_DIR, `${src.slug}.html`);
    writeFileSync(outPath, mainBody);
    console.log(`  wrote ${outPath} (${mainBody.length} chars)`);

    if (pageScripts.length > 0) {
      const scriptsPath = join(OUT_DIR, `${src.slug}.scripts.json`);
      writeFileSync(scriptsPath, JSON.stringify(pageScripts, null, 2));
      console.log(`  wrote ${scriptsPath} (${pageScripts.length} script blocks)`);
    }
  }

  console.log('done.');
}

main();
