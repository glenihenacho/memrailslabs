import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Docs — MemRails',
  description:
    'MemRails documentation. Two independent integration surfaces over the same governed memory: the MCP tool suite for agent-native access, and the HTTP API suite for everything else.',
};

/* ── data ──────────────────────────────────────────────────────────────────
   The docs are data-driven so the two suites stay comprehensive and easy to
   keep in sync with src/lib/mcp/tools.ts and src/app/api/**. */

type Param = { name: string; type: string; required?: boolean; note: string };

type Tool = {
  id: string;
  name: string;
  purpose: string;
  input: Param[];
  returns: string;
};

const MCP_TOOLS: Tool[] = [
  {
    id: 'mcp-retrieve',
    name: 'memrails.memory.retrieve',
    purpose: 'Retrieve governed memory for local inference — a scoped, explainable context bundle.',
    input: [
      { name: 'task_context', type: 'string', required: true, note: 'What the agent is about to do.' },
      { name: 'project_id', type: 'string', note: 'Scope. Defaults to the project_memrails namespace.' },
      { name: 'agent_id', type: 'string', note: 'Optional finer scope; project-wide if omitted.' },
      { name: 'max_tokens', type: 'number', note: 'Context token budget for the bundle.' },
      { name: 'retrieval_mode', type: "'exact' | 'tree' | 'hybrid' | 'hot' | 'debug'", note: 'How the MemoryIndex is walked. Default tree.' },
    ],
    returns: `ContextBundle — memories[] (each with reason_selected, score,
tokens), omitted[], retrieval_trace (branches walked, policy filters,
candidates), tokens_returned, and usage.`,
  },
  {
    id: 'mcp-write',
    name: 'memrails.memory.write',
    purpose: 'Write a governed memory record (deduped, contradiction-checked). Never rewrites canonical markdown.',
    input: [
      { name: 'content', type: 'string', required: true, note: 'The memory body.' },
      { name: 'memory_type', type: 'string', note: 'decision · preference · note · summary · extraction · correction · constraint · claim.' },
      { name: 'confidence', type: 'number', note: '0–1 calibrated confidence.' },
      { name: 'tags', type: 'string[]', note: 'Labels that aid later retrieval.' },
      { name: 'project_id', type: 'string', note: 'Scope namespace.' },
    ],
    returns: `{ memory_id, status: "active" | "deduplicated", contradicts?: string[],
dedup_of?: string }`,
  },
  {
    id: 'mcp-inspect',
    name: 'memrails.memory.inspect',
    purpose: 'Open a prior retrieval by id: the trace, branches selected, scores, and what was left out.',
    input: [{ name: 'retrieval_id', type: 'string', required: true, note: 'Returned by a previous retrieve call.' }],
    returns: `{ trace, memories, omitted } — throws retrieval_not_found if the id is unknown.`,
  },
  {
    id: 'mcp-map',
    name: 'memrails.memory.map',
    purpose: 'Return the project MemoryIndex tree — the nested memory map.',
    input: [{ name: 'project_id', type: 'string', note: 'Defaults to project_memrails.' }],
    returns: `The hierarchical MemoryIndex tree for the project.`,
  },
];

type Auth = 'none' | 'demo' | 'key';

type Endpoint = {
  id: string;
  method: string;
  path: string;
  auth: Auth;
  purpose: string;
  request?: Param[];
  response: string;
};

type Group = { title: string; blurb: string; endpoints: Endpoint[] };

const API_GROUPS: Group[] = [
  {
    title: 'Account & billing',
    blurb: 'Provision a tenant, then read metered usage and the event ledger.',
    endpoints: [
      {
        id: 'api-enroll',
        method: 'POST',
        path: '/api/enroll',
        auth: 'none',
        purpose: 'Provision an isolated tenant — one email → one account, API key, and starter credits.',
        request: [
          { name: 'email', type: 'string', required: true, note: 'Account email (idempotent — re-enrolling returns the existing owner).' },
          { name: 'plan', type: "'free' | 'usage' | 'team' | 'enterprise'", note: 'Defaults to free.' },
        ],
        response: `{ owner_id, email, plan, api_key: "mr_…", credits_remaining }`,
      },
      {
        id: 'api-usage',
        method: 'GET',
        path: '/api/usage',
        auth: 'key',
        purpose: 'Metered usage summary for the authenticated owner.',
        response: `{ owner_id, plan, retrievals_total, credits_remaining, spend_usd,
  projected_cost_usd, billing_unit }`,
      },
      {
        id: 'api-ledger',
        method: 'GET',
        path: '/api/ledger',
        auth: 'key',
        purpose: 'The append-only event ledger scoped to the caller (retrievals, writes, billing events).',
        response: `{ events: LedgerEvent[] } — each event carries type, hashes, cost, and created_at.`,
      },
    ],
  },
  {
    title: 'Memory',
    blurb: 'The core surface: retrieve a governed bundle, write proposals, and manage records over their lifecycle.',
    endpoints: [
      {
        id: 'api-retrieve',
        method: 'POST',
        path: '/api/memory/retrieve',
        auth: 'demo',
        purpose: 'Governed retrieval → a token-budgeted, explainable context bundle. The one billable call.',
        request: [
          { name: 'task_context', type: 'string (1–4000)', required: true, note: 'The retrieval query.' },
          { name: 'project_id', type: 'string', note: 'Scope. Default project_memrails.' },
          { name: 'agent_id', type: 'string', note: 'Optional finer scope.' },
          { name: 'max_tokens', type: 'integer (1–8000)', note: 'Context token budget.' },
          { name: 'retrieval_mode', type: "'exact'|'tree'|'hybrid'|'hot'|'debug'", note: 'Default tree.' },
          { name: 'include_evidence', type: 'boolean', note: 'Attach evidence references.' },
          { name: 'include_disputed', type: 'boolean', note: 'Include disputed memories (off by default).' },
          { name: 'include_packet', type: 'boolean', note: 'Also synthesize a compressed packet.' },
        ],
        response: `{ context_bundle_id, retrieval_id, scope, mode,
  memories: [{ memory_id, summary, content, confidence, reason_selected, score, tokens }],
  omitted: [{ memory_id, reason }],
  tokens_returned, token_budget, retrieval_trace, packet,
  usage: { billable_retrievals, credits_remaining, credit_exhausted }, latency_ms }`,
      },
      {
        id: 'api-write',
        method: 'POST',
        path: '/api/memory/write',
        auth: 'key',
        purpose: 'Governed write — deduplicated and contradiction-checked. Returns a record, not a silent mutation.',
        request: [
          { name: 'content', type: 'string (1–8000)', required: true, note: 'The memory body.' },
          { name: 'summary', type: 'string (≤400)', note: 'One-line summary.' },
          { name: 'memory_type', type: 'enum', note: 'decision · preference · note · summary · extraction · correction · constraint · claim.' },
          { name: 'confidence', type: 'number (0–1)', note: 'Calibrated confidence.' },
          { name: 'sensitivity', type: "'normal'|'sensitive'|'restricted'", note: 'Handling class.' },
          { name: 'tags', type: 'string[]', note: 'Retrieval labels.' },
          { name: 'index_path', type: 'string', note: 'MemoryIndex node path.' },
          { name: 'source', type: 'object', note: '{ type, id, ref, hash } provenance.' },
        ],
        response: `{ memory_id, status: "active" | "deduplicated", contradicts?: [], dedup_of?: "mem_…" }`,
      },
      {
        id: 'api-get',
        method: 'GET',
        path: '/api/memory/{id}',
        auth: 'demo',
        purpose: 'Read a single memory record by id (scoped to the caller).',
        response: `MemoryRecord — { memory_id, scope, memory_type, status, confidence,
  content, summary, tags, contradictions, index_path, current_version, created_at, … }`,
      },
      {
        id: 'api-delete',
        method: 'DELETE',
        path: '/api/memory/{id}',
        auth: 'key',
        purpose: 'Tombstone a memory (soft delete; canonical body preserved for audit). Optional ?reason=.',
        response: `{ memory_id, status: "tombstoned" }`,
      },
      {
        id: 'api-supersede',
        method: 'POST',
        path: '/api/memory/{id}/supersede',
        auth: 'key',
        purpose: 'Mark a memory superseded and optionally point it at a replacement (by id or inline).',
        request: [
          { name: 'reason', type: 'string (≤500)', note: 'Why it was superseded.' },
          { name: 'new_memory_id', type: 'string', note: 'Existing replacement. Mutually exclusive with new_memory.' },
          { name: 'new_memory', type: 'object', note: 'Inline replacement (same shape as write).' },
        ],
        response: `{ superseded: "mem_…", replacement: "mem_…" | null }`,
      },
      {
        id: 'api-dispute',
        method: 'POST',
        path: '/api/memory/{id}/dispute',
        auth: 'key',
        purpose: 'Flag a memory as contested — halves confidence and excludes it from retrieval by default.',
        request: [{ name: 'reason', type: 'string (1–500)', required: true, note: 'Why it is disputed.' }],
        response: `{ memory_id, status: "disputed", confidence }`,
      },
      {
        id: 'api-export',
        method: 'GET',
        path: '/api/memory/export',
        auth: 'demo',
        purpose: 'Export the caller’s registry. No lock-in — read it all out any time.',
        request: [
          { name: 'format', type: "'json' | 'jsonl' | 'markdown'", note: 'Query param. Default json.' },
          { name: 'project_id', type: 'string', note: 'Query param. Filter to one project.' },
        ],
        response: `json: { count, artifact_ref, records[] } · jsonl: ndjson stream · markdown: text/markdown`,
      },
      {
        id: 'api-map',
        method: 'GET',
        path: '/api/memory/map',
        auth: 'demo',
        purpose: 'Project the MemoryIndex tree for a project (?project_id=).',
        response: `{ project_id, map } — the nested index tree.`,
      },
      {
        id: 'api-query',
        method: 'POST',
        path: '/api/memory/query',
        auth: 'none',
        purpose: 'Synthesize a compressed packet over the curated corpus via the L1–L5 stack (public).',
        request: [
          { name: 'query', type: 'string (1–2000)', required: true, note: 'The question.' },
          { name: 'intent', type: "'answer'|'summarize'|'compare'|'extract'|'refactor'|'route'", note: 'Synthesis intent.' },
          { name: 'max_tokens', type: 'integer (1–2000)', note: 'Packet token cap.' },
        ],
        response: `{ packet_id, packet, confidence, tokens, contradictions_surfaced,
  evidence: [{ claim_id, weight, source_file }], input_hash, output_hash, resolved_layer }`,
      },
    ],
  },
  {
    title: 'Retrievals & feedback',
    blurb: 'Replay why a bundle came out the way it did, and feed quality signals back.',
    endpoints: [
      {
        id: 'api-trace',
        method: 'GET',
        path: '/api/retrievals/{id}/trace',
        auth: 'demo',
        purpose: 'Replay a past retrieval’s full trace — branches selected, scoring, and omissions.',
        response: `{ retrieval_id, query, scope, trace, memories: [{ memory_id, score, reason_selected }], omitted }`,
      },
      {
        id: 'api-feedback',
        method: 'POST',
        path: '/api/feedback',
        auth: 'demo',
        purpose: 'Rate a retrieval or a specific memory to train ranking.',
        request: [
          { name: 'retrieval_id', type: 'string', required: true, note: 'The retrieval being rated.' },
          { name: 'memory_id', type: 'string', note: 'A specific memory in it (optional).' },
          { name: 'rating', type: "'positive' | 'negative'", required: true, note: 'The signal.' },
          { name: 'comment', type: 'string (≤2000)', note: 'Free-form note.' },
        ],
        response: `{ feedback_id, retrieval_id, memory_id, rating, created_at }`,
      },
    ],
  },
  {
    title: 'Platform',
    blurb: 'Inspect the infrastructure itself.',
    endpoints: [
      {
        id: 'api-stack',
        method: 'GET',
        path: '/api/stack',
        auth: 'none',
        purpose: 'The canonical rail map — planes, providers, and what each graduates to (public).',
        response: `{ summary, core, global_plane, per_owner_plane, rails: [{ id, scope, provider, graduates_to }] }`,
      },
    ],
  },
];

/* ── presentational helpers ─────────────────────────────────────────────── */

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--cyan)',
  POST: 'var(--signal)',
  DELETE: 'var(--evidence-bad)',
};

function MethodTag({ method }: { method: string }) {
  return (
    <span
      className="font-mono text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded border"
      style={{
        color: METHOD_COLOR[method] ?? 'var(--foreground)',
        borderColor: `color-mix(in oklab, ${METHOD_COLOR[method] ?? 'var(--foreground)'} 45%, transparent)`,
        background: `color-mix(in oklab, ${METHOD_COLOR[method] ?? 'var(--foreground)'} 8%, transparent)`,
      }}
    >
      {method}
    </span>
  );
}

const AUTH_LABEL: Record<Auth, string> = {
  none: 'Public',
  demo: 'Key optional',
  key: 'API key',
};

function AuthTag({ auth }: { auth: Auth }) {
  const color = auth === 'key' ? 'var(--signal)' : auth === 'demo' ? 'var(--evidence-warn)' : 'var(--evidence-good)';
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {AUTH_LABEL[auth]}
    </span>
  );
}

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border hairline">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="bg-graphite/60 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-t hairline align-top">
              <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap">
                <span className="text-foreground">{p.name}</span>
                {p.required && <span className="text-signal" title="required"> *</span>}
              </td>
              <td className="px-3 py-2 font-mono text-[11.5px] text-cyan whitespace-nowrap">{p.type}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border hairline bg-graphite">
      {label && (
        <div className="border-b hairline px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-foreground">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const TOC = [
  { href: '#mcp', label: 'MCP suite' },
  { href: '#mcp-overview', label: 'Connect', sub: true },
  ...MCP_TOOLS.map((t) => ({ href: `#${t.id}`, label: t.name.replace('memrails.memory.', 'memory.'), sub: true })),
  { href: '#api', label: 'API suite' },
  { href: '#api-overview', label: 'Auth & billing', sub: true },
  ...API_GROUPS.map((g) => ({ href: `#${g.endpoints[0].id}`, label: g.title, sub: true })),
];

export default function DocsPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b hairline">
        <div className="absolute inset-0 grid-bg opacity-50 mask-radial-center" />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-14">
          <div className="ref-eyebrow text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground" data-ref="00">
            <span className="ref-rule" />
            Documentation
          </div>
          <h1 className="mt-5 font-display font-medium text-4xl md:text-6xl tracking-[-0.03em] max-w-3xl leading-[1.03]">
            Two surfaces, <span className="text-gradient-signal">one governed memory.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            MemRails exposes the same governed memory two ways — pick whichever fits your stack. The{' '}
            <span className="text-foreground">MCP suite</span> is agent-native: tools your model calls in-loop. The{' '}
            <span className="text-foreground">HTTP API suite</span> is everything else: a plain REST surface for any
            language or runtime. The two are documented independently below; you never need both.
          </p>
        </div>
      </section>

      {/* BODY: sticky TOC + content */}
      <div className="mx-auto max-w-7xl px-6 py-14 lg:grid lg:grid-cols-[210px_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <nav className="lg:sticky lg:top-24 space-y-1.5 text-[13px]">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-3">On this page</div>
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`block transition hover:text-signal ${
                  'sub' in item && item.sub ? 'pl-3 text-muted-foreground' : 'font-medium text-foreground'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-20">
          {/* ============ MCP SUITE ============ */}
          <section id="mcp" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-medium text-3xl md:text-4xl tracking-tight">MCP suite</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal border border-signal/40 rounded-full px-2 py-0.5">
                agent-native
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Four tools that expose governed memory directly to an agent loop. The dispatcher runs in-process against
              the file-canonical library; a stdio JSON-RPC transport wraps it so MCP clients (Claude Code, and others)
              can call the tools natively. Read-only by default — writes are governed proposals.
            </p>

            <div id="mcp-overview" className="scroll-mt-24 mt-8 rounded-xl border hairline bg-graphite/40 p-6">
              <h3 className="font-display text-lg tracking-tight">Connect</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Run the stdio server and register it with your MCP client. It speaks JSON-RPC over stdio and dispatches
                to the same governed primitives as the API.
              </p>
              <CodeBlock label="shell">{`# start the MCP server (stdio JSON-RPC)
npm run mcp:server`}</CodeBlock>
              <CodeBlock label="claude code · .mcp.json">{`{
  "mcpServers": {
    "memrails": { "command": "npm", "args": ["run", "mcp:server"] }
  }
}`}</CodeBlock>
            </div>

            <div className="mt-8 space-y-6">
              {MCP_TOOLS.map((tool) => (
                <article key={tool.id} id={tool.id} className="scroll-mt-24 rounded-xl border hairline bg-graphite/30 p-6">
                  <h3 className="font-mono text-[15px] text-foreground">
                    <span className="text-muted-foreground">memrails.memory.</span>
                    <span className="text-signal">{tool.name.replace('memrails.memory.', '')}</span>
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{tool.purpose}</p>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Input</div>
                  <ParamTable params={tool.input} />
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Returns</div>
                  <CodeBlock>{tool.returns}</CodeBlock>
                </article>
              ))}
            </div>
          </section>

          {/* ============ API SUITE ============ */}
          <section id="api" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-medium text-3xl md:text-4xl tracking-tight">API suite</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan border border-cyan/40 rounded-full px-2 py-0.5">
                REST · any runtime
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              A plain JSON-over-HTTP surface for everything that isn’t an MCP client. Same governed memory, same scope
              rules, same metering — callable from any language.
            </p>

            <div id="api-overview" className="scroll-mt-24 mt-8 rounded-xl border hairline bg-graphite/40 p-6 space-y-5">
              <div>
                <h3 className="font-display text-lg tracking-tight">Authentication</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Pass your key as a bearer token. Without a key you get read-only access to the public demo tenant;
                  mutations require a real key. Provision one with <code className="code-pink">POST /api/enroll</code>.
                </p>
                <CodeBlock label="header">{`Authorization: Bearer mr_your_key_here`}</CodeBlock>
              </div>
              <div className="flex flex-wrap gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1.5 rounded-full border hairline bg-graphite/40 px-3 py-1 font-mono text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--evidence-good)' }} />Public — no key</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border hairline bg-graphite/40 px-3 py-1 font-mono text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--evidence-warn)' }} />Key optional — demo reads</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border hairline bg-graphite/40 px-3 py-1 font-mono text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} />API key required</span>
              </div>
              <div>
                <h3 className="font-display text-lg tracking-tight">Billing &amp; scope</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  One successful <code className="code-pink">memory.retrieve()</code> = one billable retrieval
                  (<span className="text-foreground">$0.002</span>, $2 / 1,000); the free tier is retrieval credits, not
                  quotas. Writes are free; context tokens are your model provider’s charge. Every record is scoped to an{' '}
                  <code className="code-cyan">owner / project / agent</code> triple — the owner is derived from your key and
                  never trusted from the body, so tenants can’t read across namespaces.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-12">
              {API_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="font-display text-xl tracking-tight">{group.title}</h3>
                  <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted-foreground">{group.blurb}</p>
                  <div className="mt-5 space-y-5">
                    {group.endpoints.map((ep) => (
                      <article key={ep.id} id={ep.id} className="scroll-mt-24 rounded-xl border hairline bg-graphite/30 p-6">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <MethodTag method={ep.method} />
                          <code className="font-mono text-[14px] text-foreground break-all">{ep.path}</code>
                          <span className="ml-auto">
                            <AuthTag auth={ep.auth} />
                          </span>
                        </div>
                        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{ep.purpose}</p>
                        {ep.request && (
                          <>
                            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Request</div>
                            <ParamTable params={ep.request} />
                          </>
                        )}
                        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Response</div>
                        <CodeBlock>{ep.response}</CodeBlock>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-xl border hairline bg-graphite/40 p-8 text-center">
            <h2 className="font-display font-medium text-2xl md:text-3xl tracking-tight">Get a key, make a call.</h2>
            <p className="mt-3 max-w-xl mx-auto text-[14px] text-muted-foreground">
              Enroll for retrieval credits, then point either surface at your corpus.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/pricing" className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-sm shadow-signal hover:opacity-95 transition tracking-tight">
                See pricing →
              </Link>
              <Link href="/mcp" className="inline-flex items-center gap-2 h-11 px-5 rounded-md border hairline text-sm font-medium hover:border-signal/60 hover:text-signal transition">
                MCP overview →
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
