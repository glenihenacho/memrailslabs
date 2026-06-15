# CLAUDE.md — MemRails Fulfillment Constitution

> Purpose: Give Claude Code enough product, architecture, and execution context to build, refactor, and ship MemRails-grade deliverables without re-asking foundational questions.

---

## 0. Founder Directive

You are operating as a YC-style technical founder and fulfillment engineer.

Default posture:

- Ship the smallest working system that proves the wedge.
- Prefer visible product behavior over abstract architecture.
- Do not overbuild platform primitives before the user can experience the core loop.
- Every implementation decision must increase one of:
  - retrieval density,
  - packet quality,
  - agent usability,
  - observability,
  - monetization readiness,
  - deployment speed.

MemRails is **knowledge density infrastructure for agentic software**. Treat memory as a protocol and operating layer, not a vendor graph, chatbot feature, or generic vector database wrapper.

---

## 0.5 Locked Product Definition (v2 — governed retrieval reconcile)

> This section supersedes the framing below where they conflict. The packet
> contract, retrieval discipline, and design language in §1–§20 still hold; the
> primitive and the primary output are restated here.

**MemRails is cloud-hosted memory infrastructure for locally inferred agents.**
The core primitive is:

```ts
memory.retrieve(task_context) // → ContextBundle
```

Not `action.retrieve()`, not `provider.execute()`, not `credential.use()`. The
local agent asks for memory, receives a governed **context bundle**, and infers
locally — no key handling, no decryption, no local vector DB, no DB management.

How the two framings reconcile:

| v1 framing (§1+) | v2 reconcile (this section) |
|---|---|
| `memory.query()` → packet | `memory.retrieve()` → context bundle (packet is optional synthesis inside it) |
| L1–L5 retrieval stack | the **synthesis surface**; governed retrieval (scope → policy → MemoryIndex tree → ranking) leads |
| canonical markdown only | curated markdown **plus** governed registry + JSON overlay + JSONL stores (still file-canonical, Git-versioned) |
| packet provenance | context-bundle `reason_selected` + `omitted` + `retrieval_trace` |

Primary retrieval is a **PageIndex-inspired MemoryIndex** tree (not vector
top-k). pgvector / Qdrant are optional fallback rails. Authority is PostgreSQL
in production; the MVP runs file-canonical (`data/governance.json`,
`data/written-memory.jsonl`, `data/accounts.json`, `data/logs/*.jsonl`).

**Commercial primitive = the metered retrieval.** One successful
`memory.retrieve()` = one billable retrieval (default `$0.002`). Writes are
cheap; context tokens are the model provider's charge, not MemRails'. No
arbitrary user-facing quotas — the free tier is **retrieval credits**.
Infrastructure is three planes: **SQL = government** (authority/placement),
**MemoryIndex = protocol** (retrieval), **federated NoSQL accounts =
infrastructure** (storage). No tiers/pools; the user never brings or sees
accounts. Billing code: `src/lib/billing/`, `src/lib/accounts/`,
`src/lib/federation/`, types in `src/types/billing.ts`, API at
`/api/{enroll,usage}`. Canonical: `knowledge/billing-model.md`,
`knowledge/federation.md`.

Canonical rail map (Postgres governs, MemoryIndex retrieves, Redis accelerates,
R2 preserves, telemetry prices): V1 core = **Postgres + MemoryIndex + Redis +
R2** + Postgres-first telemetry. Authority (Postgres) and Analytics (ClickHouse)
are **global** planes; the federated NoSQL accounts (artifact/document) are
**per-owner**. V2 rails (pgvector/Qdrant, Neo4j, ClickHouse, OpenSearch,
Couchbase, ScyllaDB, Firestore) are added only on measured pressure. Rails are
capabilities, not tiers — `src/lib/rails/{registry,hot,artifact}.ts`, inspectable
at `GET /api/stack`. Canonical: `knowledge/stack.md`.

Canonical knowledge: `knowledge/governed-retrieval.md`, `knowledge/memory-index.md`
(claim), `knowledge/data-model.md`, `knowledge/roadmap.md`, `knowledge/non-goals.md`.

Code map: `src/lib/memory/{registry,scope,ranking,index-tree,retrieve,write,lifecycle,telemetry,synthesize}.ts`,
types in `src/types/{governed,bundle,index-tree}.ts`, API under
`src/app/api/memory/*` + `src/app/api/{retrievals,feedback}/*`, SDKs in
`src/sdk/` and `sdk/python/`, MCP in `src/lib/mcp/tools.ts`.

**Non-goals:** provider actions, credential custody, freemium enrollment,
generic vector-DB-as-product, and `conversation → chunk → embed → top_k → prompt`.

---

## 1. Product Truth

### One-line positioning

MemRails turns messy knowledge into compact, evidence-graded packets that agents can query, inspect, stream, and pay for.

### Core thesis

Agents do not need more raw context. They need denser, inspectable memory packets.

The product value is not “we store memories.” The product value is:

1. retrieve cheaply first,
2. filter evidence,
3. compress only when necessary,
4. return a structured packet,
5. expose provenance,
6. log the decision trail,
7. make the packet billable.

### Product primitives

| Primitive | Meaning | Implementation implication |
|---|---|---|
| Memory | Canonical markdown-backed knowledge | Store human-readable source files and extracted claims |
| Harness | In-loop agent runtime binding | Agents call memory before model calls |
| Packet | Billable compressed answer unit | Standardize output schema |
| Console | Observability layer | Log every query, packet, confidence, provenance, hash |
| MCP | Agent tool surface | Expose `memory.query`, `memory.write`, `memory.inspect` |
| MPP/x402-style payments | Monetization rail | Session/budget authorization before paid packet streaming |
| Compress-v1 | Specialized L5 synthesis layer | Compression is last resort and value layer |

---

## 2. Non-Negotiable Product Rules

### Rule 1 — Memory is file-canonical

The system must preserve a plain-text, Git-versionable source of truth.

Required:

- `/knowledge/**/*.md` as canonical content.
- Structured frontmatter where useful.
- Generated indexes are derived artifacts, not the canonical source.
- No opaque-only memory graph.

### Rule 2 — Cheap filters before expensive synthesis

Never call a model first when a cheaper retrieval layer can answer.

Retrieval order:

```yaml
retrieval:
  - grep
  - key
  - semantic
  - evidence
  - compress
```

L5 compression is a fallback and synthesis layer, not the default retrieval method.

### Rule 3 — Packets require provenance

Every packet must include:

- answer text,
- confidence,
- token count,
- provenance references,
- evidence IDs,
- contradictions surfaced,
- input hash,
- output hash,
- model/compressor version.

No packet ships as anonymous prose.

### Rule 4 — Writes are proposals, not silent mutations

`memory.write` does not directly rewrite canonical memory.

It proposes a refactor:

- new claim,
- updated confidence,
- contradiction,
- source link,
- file split,
- stale claim downgrade.

A review step or validator gate must apply the change.

### Rule 5 — Console is not optional

If the agent uses memory, the user must be able to inspect what happened.

Log:

- query,
- resolved layer,
- latency,
- packet ID,
- packet tokens,
- confidence,
- evidence IDs,
- input hash,
- output hash,
- cost attribution,
- refactor events.

### Rule 6 — Keep the protocol model-agnostic

The packet contract must survive model swaps.

Claude, OpenAI, local models, and MemRails Compress-v1 can all produce packets, but the product is the packet contract plus retrieval/evidence orchestration.

### Rule 7 — No lock-in story

Users must be able to:

- read their memory files,
- export logs as JSONL,
- self-host the harness,
- bring their own model key,
- eject from managed infrastructure.

---

## 3. Claude Code Operating Rules

When working in this repository:

1. Read this file first.
2. Inspect existing files before creating new ones.
3. Prefer patches over rewrites.
4. Preserve the premium MemRails design language.
5. Maintain compatibility with Claude Code, MCP clients, and local CLI use.
6. Do not invent unsupported backend services.
7. If infrastructure is missing, stub it with a clear interface and TODO.
8. Every feature must include an acceptance test or manual verification path.
9. Every generated packet-like object must be inspectable.
10. Favor boring storage and clear schemas over clever abstractions.

---

## 4. Expected Repository Shape

Use this structure unless the existing repo clearly differs.

```txt
/
├── CLAUDE.md
├── README.md
├── package.json
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── harness/
│   │   ├── console/
│   │   ├── mcp/
│   │   ├── pricing/
│   │   └── docs/
│   ├── components/
│   │   ├── marketing/
│   │   ├── console/
│   │   ├── packet/
│   │   └── shared/
│   ├── lib/
│   │   ├── memory/
│   │   │   ├── grep.ts
│   │   │   ├── key.ts
│   │   │   ├── semantic.ts
│   │   │   ├── evidence.ts
│   │   │   ├── compress.ts
│   │   │   ├── packet.ts
│   │   │   └── index.ts
│   │   ├── mcp/
│   │   ├── ledger/
│   │   ├── pricing/
│   │   └── observability/
│   ├── types/
│   │   ├── packet.ts
│   │   ├── evidence.ts
│   │   └── memory.ts
│   └── styles/
├── knowledge/
│   ├── index.md
│   ├── product.md
│   ├── architecture.md
│   ├── pricing.md
│   └── claims/
├── data/
│   ├── generated/
│   └── logs/
├── tests/
│   ├── memory/
│   ├── packet/
│   └── mcp/
└── scripts/
    ├── index-knowledge.ts
    ├── run-query.ts
    └── export-ledger.ts
```

If this is currently a static HTML repo, migrate gradually:

1. preserve current HTML pages,
2. extract design tokens,
3. componentize repeated header/footer/cards,
4. build functional memory demo,
5. then replace static demos with live data.

---

## 5. Design System Requirements

### Brand feel

Premium technical infrastructure. Dark, precise, dense, high-signal.

### Visual tokens

Use the existing MemRails direction:

```css
--background: rgb(25, 23, 31);
--foreground: rgb(243, 242, 246);
--card: rgb(31, 29, 38);
--signal: #ef117e;
--graphite: rgb(33, 31, 41);
--graphite-2: rgb(40, 37, 49);
--cyan: rgb(76, 200, 224);
--evidence-good: rgb(86, 209, 113);
--evidence-warn: rgb(229, 195, 78);
--evidence-bad: rgb(225, 90, 78);
```

### Typography

- Primary UI: Inter.
- Display: Inter Tight.
- Code/data: JetBrains Mono.
- Editorial emphasis: Newsreader italic.

### UI rules

- Dark theme first.
- Hairline borders.
- Monospace metadata bars.
- Dense cards.
- Avoid generic SaaS gradients.
- Pink is a signal color, not decoration.
- Console and packet views should feel inspectable, not ornamental.

---

## 6. Core Domain Model

### EvidenceClaim

```ts
export type EvidenceClaim = {
  id: string;
  source_file: string;
  source_span?: {
    start_line?: number;
    end_line?: number;
    selector?: string;
  };
  claim: string;
  confidence: number;
  evidence_urls?: string[];
  contradictions?: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
};
```

### RetrievalResult

```ts
export type RetrievalResult = {
  query: string;
  layer: "L1_GREP" | "L2_KEY" | "L3_SEMANTIC" | "L4_EVIDENCE" | "L5_COMPRESS";
  latency_ms: number;
  candidates: EvidenceClaim[];
  resolved: boolean;
  reason: string;
};
```

### MemoryPacket

```ts
export type MemoryPacket = {
  packet_id: string;
  query: string;
  intent: "answer" | "summarize" | "compare" | "extract" | "refactor" | "route";
  packet: string;
  confidence: number;
  tokens: number;
  contradictions_surfaced: number;
  evidence: Array<{
    claim_id: string;
    weight: number;
    source_file: string;
  }>;
  input_hash: string;
  output_hash: string;
  model_or_compressor: string;
  created_at: string;
};
```

### RefactorProposal

```ts
export type RefactorProposal = {
  refactor_id: string;
  type:
    | "ADD_CLAIM"
    | "UPDATE_CONFIDENCE"
    | "ADD_CONTRADICTION"
    | "SPLIT_TOPIC"
    | "DEPRECATE_STALE_CLAIM"
    | "LINK_SOURCE";
  target_file?: string;
  target_claim_id?: string;
  proposed_diff: string;
  evidence: EvidenceClaim[];
  stake?: number;
  status: "proposed" | "reviewing" | "accepted" | "rejected";
  created_at: string;
};
```

### LedgerEvent

```ts
export type LedgerEvent = {
  event_id: string;
  event_type:
    | "QUERY"
    | "PACKET_CREATED"
    | "MCP_TOOL_CALL"
    | "REFACTOR_PROPOSED"
    | "REFACTOR_ACCEPTED"
    | "PAYMENT_AUTHORIZED"
    | "PACKET_BILLED";
  actor_id?: string;
  session_id?: string;
  packet_id?: string;
  input_hash?: string;
  output_hash?: string;
  cost_cents?: number;
  metadata: Record<string, unknown>;
  created_at: string;
};
```

---

## 7. Retrieval Stack Fulfillment

### L1 — Grep

Purpose: literal retrieval.

Implementation:

- Search markdown files.
- Return exact matches and surrounding context.
- Use before embeddings.
- Useful for names, commands, definitions, known IDs.

Acceptance:

- Given a query with an exact keyword, return matching file and excerpt.
- Must run without network or model dependency.

### L2 — Key lookup

Purpose: structured lookup.

Implementation:

- Parse frontmatter and claim IDs.
- Support aliases, tags, and canonical keys.
- Use for stable concepts and product primitives.

Acceptance:

- Given `packet contract`, return canonical product definition and related claims.
- No model call.

### L3 — Semantic retrieval

Purpose: approximate meaning match.

Implementation:

- Use embeddings if available.
- If embeddings unavailable, provide placeholder interface and deterministic fallback.
- Do not block MVP on perfect vector search.

Acceptance:

- Related query should return semantically relevant claims.
- Must include score and source.

### L4 — Evidence filter

Purpose: quality gate.

Implementation:

- Rank candidates by confidence, freshness, source quality, contradiction state.
- Remove low-confidence candidates unless requested.
- Surface contradictions rather than hiding them.

Acceptance:

- Claims below confidence floor are excluded or flagged.
- Contradictions are included in packet metadata.

### L5 — Compress

Purpose: synthesize evidence into a compact packet.

Implementation:

- Accept only L4-filtered candidate evidence.
- Enforce max token budget, default 600.
- Preserve provenance.
- Include confidence and contradictions.
- Never synthesize beyond available evidence without labeling uncertainty.

Acceptance:

- Packet is ~500–600 tokens max by default.
- Packet includes claim IDs and hashes.
- Unsupported claims are rejected or labeled.

---

## 8. MCP Fulfillment

Expose a minimal MCP server surface.

### Tool: memory.query

```ts
input = {
  query: string;
  intent?: "answer" | "summarize" | "compare" | "extract" | "route";
  max_tokens?: number;
};

output = MemoryPacket;
```

Behavior:

- Runs query through L1–L5.
- Returns compressed packet only if lower layers do not fully resolve.
- Logs event as `MCP_TOOL_CALL` and `PACKET_CREATED` when applicable.

### Tool: memory.write

```ts
input = {
  claim: string;
  evidence: string[];
  target_file?: string;
  stake?: number;
};

output = {
  refactor_id: string;
  status: "proposed";
};
```

Behavior:

- Creates refactor proposal.
- Does not silently mutate canonical memory.
- Requires explicit review before write is applied.

### Tool: memory.inspect

```ts
input = {
  packet_id: string;
};

output = {
  packet: MemoryPacket;
  evidence_bundle: EvidenceClaim[];
  provenance_weights: Record<string, number>;
  hashes: {
    input_hash: string;
    output_hash: string;
  };
};
```

Behavior:

- Opens packet lineage.
- Shows source claims, weights, hashes, and contradictions.

### Resource: memory://files

Expose readable memory files.

Rules:

- Read-only by default.
- Write scope must be explicit.
- All calls are logged.

---

## 9. Console Fulfillment

Build Console around four primary surfaces.

### 1. Query Stream

Columns:

- time,
- query,
- resolved layer,
- latency,
- tokens,
- confidence,
- packet ID,
- cost.

Required stats:

- percent resolved below L5,
- median packet tokens,
- p95 latency,
- monthly packet count.

### 2. Packet Inspector

Panels:

- query,
- input evidence bundle,
- compressed output,
- provenance weights,
- contradictions,
- hashes,
- model/compressor version.

### 3. Refactor Feed

Show:

- diff,
- evidence added,
- confidence changed,
- contradiction added,
- validator status,
- accepted/rejected state.

### 4. Audit & Billing Ledger

Show:

- input hash,
- output hash,
- packet count,
- model/compressor,
- billable packet total,
- JSONL export.

Acceptance:

- A user can click a query and understand why the packet was generated.
- A user can reconcile billed packets against logs.
- A user can export raw ledger data.

---

## 10. Harness Fulfillment

The harness is where MemRails runs inside the agent loop.

### Self-host path

Implement:

```ts
import { memory } from "@memrails/memory";

const packet = await memory.query({
  query: userTask,
  intent: "answer",
  max_tokens: 600,
});
```

Rules:

- Runs in-process.
- Points at `/knowledge`.
- Versions memory changes through Git.
- User brings model key if using L5 compression.

### Managed path

Simulate or implement:

```bash
memrails harness deploy --managed
```

Deployment flow:

1. provision OpenClaw harness,
2. index `knowledge/`,
3. apply pre-tuned config,
4. bind Compress-v1,
5. wire integrations,
6. return endpoint,
7. show stream in Console.

Pre-tuned config baseline:

```yaml
retrieval: [grep, key, semantic, evidence, compress]

compress:
  model: compress-v1
  max_tokens: 600
  fidelity_floor: 0.85

evidence:
  min_confidence: 0.75
  citation_density: balanced

integrations: auto
```

Integrations to represent:

- Claude Code,
- OpenClaw,
- OpenCode,
- Cursor,
- Codex,
- LangGraph,
- CrewAI,
- n8n,
- MCP.

---

## 11. Pricing & Billing Fulfillment

Pricing logic must be packet-based, not seat-based.

### Billing unit

One packet = one completed evidence-graded synthesis.

Default assumption:

- One packet is typically around 500 output tokens.
- Orchestration fee is separate from model inference.
- BYO model means user pays provider directly.
- Managed Compress-v1 means MemRails handles compression model serving.

### Orchestration

Baseline:

```txt
$5 / 10K packets
```

Implementation:

```ts
export function calculateOrchestrationCost(packetCount: number) {
  return (packetCount / 10_000) * 5;
}
```

Do not charge seat fees by default.

### Pricing UI requirements

Must support:

- packet volume slider,
- BYO model mode,
- managed Compress-v1 mode,
- monthly/yearly cost,
- MemRails line item,
- provider line item,
- annualized estimate.

---

## 12. MPP / Payment Fulfillment

The monetization surface should support agent-paid packet sessions.

Core concept:

- Agent authorizes budget once.
- Agent streams packets against that budget.
- Each packet decrements budget through an off-chain/session voucher.
- The session is the unit, not each individual call.

Supported rail labels:

- USDC / Tempo,
- Cards / Stripe,
- Visa network,
- Bitcoin / Lightning,
- Shared Payment Tokens,
- Custom method.

Implementation stance:

- If real payment infra is unavailable, stub session authorization and voucher settlement.
- Keep interface compatible with future x402/MPP-style payment challenges.

Types:

```ts
export type PaymentSession = {
  session_id: string;
  payer_agent_id: string;
  endpoint_id: string;
  budget_cents: number;
  spent_cents: number;
  rail: "usdc_tempo" | "stripe_card" | "visa" | "lightning" | "custom";
  status: "authorized" | "active" | "exhausted" | "closed";
  created_at: string;
};
```

---

## 13. Marketing Page Fulfillment

If asked to edit or generate pages, preserve the product narrative hierarchy.

### Core pages

| Page | Job |
|---|---|
| Home | Explain knowledge density and the L1–L5 memory stack |
| Harness | Convert teams who want deployment |
| Console | Build trust through observability |
| MCP | Show tool compatibility and agent-native access |
| MPP/Streaming | Show monetized packet sessions |
| Compress | Defend the L5 compression moat |
| Pricing | Make packet-based economics legible |

### Header nav

Product:

- Memory
- Harness
- Console
- Streaming
- MCP

Other:

- Pricing
- Research
- Blog
- Docs
- Community
- GitHub
- Start for free
- Login

### Message discipline

Say:

- “packets”
- “evidence-graded”
- “provenance”
- “retrieval stack”
- “protocol”
- “model-agnostic”
- “inspectable”
- “Git-versioned”
- “read-only by default”
- “cheap filters first”
- “compression as last resort”

Avoid:

- “AI memory app”
- “chatbot memory”
- “just vector search”
- “magic”
- “guaranteed truth”
- “perfect recall”
- “brain”
- “database of thoughts”

---

## 14. MVP Ship Plan

### Phase 1 — Static-to-functional demo

Goal: prove the packet loop.

Build:

- `/knowledge` markdown corpus.
- `memory.query()` local function.
- L1 grep.
- L2 key lookup.
- simple evidence confidence scores.
- fake L5 compressor or provider-backed compressor.
- packet schema.
- console log table.

Done when:

- User enters query.
- System returns packet.
- Console shows query, layer, packet, confidence, provenance.

### Phase 2 — MCP usable surface

Build:

- MCP server stub.
- `memory.query`.
- `memory.inspect`.
- read-only `memory://files`.
- local JSONL ledger.

Done when:

- Claude Code can query memory through MCP.
- A packet can be inspected by ID.

### Phase 3 — Refactor proposals

Build:

- `memory.write`.
- refactor proposal schema.
- diff preview.
- review/accept flow.
- Git diff generation.

Done when:

- Agent can propose a memory improvement.
- Human can accept/reject.
- Accepted change updates markdown.

### Phase 4 — Billing simulation

Build:

- packet count meter.
- pricing calculator.
- payment session stub.
- voucher ledger.

Done when:

- Packet usage produces a billable ledger.
- User can export JSONL.

### Phase 5 — Managed harness simulation

Build:

- deploy command UI.
- managed config view.
- endpoint object.
- integration chips.
- simulated live status.

Done when:

- User sees corpus-to-endpoint flow.
- Query stream links back to endpoint.

---

## 15. Acceptance Criteria for Every Pull Request

A PR is not done unless it answers:

1. What user-visible behavior changed?
2. Which product primitive did it improve?
3. Did it preserve file-canonical memory?
4. Did it avoid unnecessary L5/model calls?
5. Does every packet include provenance?
6. Is the action visible in Console or logs?
7. Can the user export or inspect the result?
8. Is there a test or manual verification script?
9. Did we avoid vendor lock-in?
10. Did we reduce ambiguity for future Claude Code runs?

---

## 16. Verification Commands

Use these commands or create equivalents.

```bash
# install
npm install

# lint
npm run lint

# typecheck
npm run typecheck

# test
npm test

# index memory
npm run memory:index

# run local query
npm run memory:query -- "what is the packet contract?"

# inspect packet
npm run memory:inspect -- "pkt_example"

# export ledger
npm run ledger:export
```

If commands are missing, add them or document why not.

---

## 17. Manual Demo Script

Use this demo to validate the product loop.

1. Open app.
2. Go to Console.
3. Run query: `what is the packet contract?`
4. Confirm L1/L2 returns candidates.
5. Confirm L4 filters evidence.
6. Confirm L5 only runs if needed.
7. Open packet inspector.
8. Confirm provenance weights exist.
9. Confirm input/output hashes exist.
10. Export ledger as JSONL.
11. Propose a refactor.
12. Review diff.
13. Accept change.
14. Confirm markdown file changed.
15. Confirm refactor appears in Console.

---

## 18. Implementation Bias

Prefer:

- TypeScript.
- Next.js or Astro depending existing repo.
- Plain markdown for canonical memory.
- JSONL for logs.
- SQLite/Postgres only when necessary.
- Deterministic local functions first.
- Provider-backed L5 only behind an interface.
- Components with explicit data contracts.

Avoid:

- early microservices,
- premature blockchain dependencies,
- opaque hosted-only storage,
- background jobs that cannot be inspected,
- unbounded autonomous writes,
- raw vector dump UX,
- generic SaaS dashboards.

---

## 19. Founder-Level Product Judgment

If choosing between two implementations:

Choose the one that makes the demo sharper.

The killer demo is:

```txt
messy knowledge in
→ cheap retrieval layers narrow it
→ evidence filter scores it
→ compact packet comes out
→ Console proves why
→ MCP lets Claude Code use it
→ ledger makes it billable
→ write path improves the memory
```

Anything outside this loop is secondary.

---

## 20. Current Strategic Wedge

The wedge is **Claude Code fulfillment**.

Build MemRails first as the memory layer a Claude Code-powered team would actually use:

- project-level memory,
- repo-aware context,
- implementation packet retrieval,
- inspectable decisions,
- refactor proposals,
- persistent markdown memory,
- MCP access,
- console audit trail.

The first buyer does not need an abstract memory market. They need Claude Code to stop losing context, stop bloating prompts, and stop making untraceable implementation decisions.

Ship that.
