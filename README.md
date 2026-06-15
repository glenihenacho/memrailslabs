# MemRails

**Cloud-hosted memory infrastructure for locally inferred agents.**

The core primitive is `memory.retrieve(task_context)`. A local agent asks for
memory and receives a governed, scoped, explainable **context bundle** — no
local database, no decryption, no key handling, no vector setup.

> Governed memory retrieval, not action retrieval. Not a generic vector
> database. See `knowledge/non-goals.md`.

## The loop

```txt
memory packet → governed registry → MemoryIndex tree → reasoning retrieval
  → context bundle → telemetry feedback
```

Retrieval pipeline: **scope → policy → MemoryIndex branch reasoning → transparent
ranking → token-budgeted bundle → telemetry**. The packet/L1–L5 stack is the
optional synthesis surface beneath it (`include_packet`).

## Quickstart

```bash
npm install
npm test                 # full suite across packet + governed paths
npm run typecheck

# In-process governed memory (no server needed):
npm run memory:retrieve -- --context "Detail the roadmap for MemRails" --mode debug
npm run memory:write -- --content "MemRails retrieves governed memory for local inference." --type decision --confidence 0.96
npm run memory:map

# Live console (governed retrieve + bundle inspector):
npm run dev   # → http://localhost:3000/console-live
```

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/memory/retrieve` | Governed retrieval → context bundle |
| POST | `/api/memory/write` | Governed write (deduped, contradiction-checked) |
| GET / DELETE | `/api/memory/:id` | Read / forget (tombstone) a memory |
| POST | `/api/memory/:id/supersede` | Mark superseded, point at replacement |
| POST | `/api/memory/:id/dispute` | Flag, drop confidence, exclude from retrieval |
| GET | `/api/memory/export` | Export registry as `json` / `jsonl` / `markdown` |
| GET | `/api/memory/map` | Project MemoryIndex tree |
| GET | `/api/retrievals/:id/trace` | Replay a retrieval's trace |
| POST | `/api/feedback` | Rate a retrieval / memory |
| POST | `/api/enroll` | Provision an isolated tenant (one email → one account + credits) |
| GET | `/api/usage` | Metered usage summary for an owner |

## Pricing — metered by retrieval

The commercial primitive is the metered retrieval: **one successful
`memory.retrieve()` = one billable retrieval** (default `$0.002`, i.e. `$2` per
1,000). Writes are cheap; context tokens are the model provider's charge, not
MemRails'. No arbitrary quotas — the free tier ships **retrieval credits**.
Infrastructure is three planes: **SQL = government** (authority/placement),
**MemoryIndex = protocol** (retrieval), **federated NoSQL accounts =
infrastructure** (storage) — managed and invisible, no BYO. Every retrieval
returns minimal `usage` and logs a billing + internal-cost event.
See `knowledge/billing-model.md` and `knowledge/federation.md`.

## SDKs & MCP

- **TypeScript:** `src/sdk/index.ts` — `new MemRails().memory.retrieve(...)`
- **Python:** `sdk/python/memrails` — `MemRails().memory.retrieve(...)`
- **CLI:** `npm run memrails -- <retrieve|write|map|inspect>`
- **MCP:** `src/lib/mcp/tools.ts` + `npm run mcp:server` (stdio JSON-RPC stub)

## Storage (file-canonical MVP)

PostgreSQL is the authority layer in production; the MVP is file-canonical and
maps one-to-one onto the production tables (`knowledge/data-model.md`):

- `knowledge/**.md` — curated canonical memory (Git-versioned).
- `data/written-memory.jsonl` — agent-written governed records.
- `data/governance.json` — status / confidence / version overlay.
- `data/logs/*.jsonl` — ledger, retrievals, feedback telemetry.

Marketing pages are preserved as static HTML in `src/marketing/` and rendered
through `src/app/*`.

## Demo

```bash
npm run dev
# 1. open /console-live
# 2. task_context: "Detail the technical requirements and roadmap for MemRails."
# 3. watch branches selected, memories with reason_selected, omissions, trace
# 4. toggle "packet" to synthesize, toggle "evidence" for full content
# 5. export: GET /api/memory/export?format=markdown
```

See `CLAUDE.md` §0.5 for the locked product definition and reconcile notes.
