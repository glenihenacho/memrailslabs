# MemRails

**Knowledge density infrastructure for agentic software.** MemRails turns
messy knowledge into compact, evidence-graded **packets** that agents can
query, inspect, stream, and pay for.

Agents don't need more raw context — they need denser, inspectable memory.
MemRails retrieves cheaply first, filters on evidence, compresses only when
necessary, and returns a structured packet with full provenance and an
auditable decision trail.

> See [`CLAUDE.md`](./CLAUDE.md) for the full product constitution.

---

## Quick start

```bash
npm install        # install dependencies
npm run dev        # Next.js app on http://localhost:3000
```

Then open the **Console** at `/console-live` and run a query such as
`what is the packet contract?`.

### Without the web app

The retrieval stack runs as plain local functions — no server, no model
key required for L1–L4.

```bash
npm run memory:index                                   # build the derived index
npm run memory:query -- "what is the packet contract?" # run a query, print the packet
npm run memory:inspect -- "pkt_..."                    # inspect a logged packet
npm run ledger:export                                  # stream the ledger as JSONL
```

---

## The retrieval stack

A query falls through cheap filters first and only reaches model-grade
synthesis (L5) when lower tiers can't resolve it (`CLAUDE.md §2 Rule 2`).

| Layer | Name | Job | Cost |
|---|---|---|---|
| **L1** | `grep` | literal substring match | no model / no network |
| **L2** | `key` | frontmatter id / alias / tag lookup | no model |
| **L3** | `semantic` | deterministic token-overlap (embeddings deferred) | no model |
| **L4** | `evidence` | confidence floor (0.75) + contradiction surfacing | no model |
| **L5** | `compress` | compact synthesis of L4-filtered evidence | last resort |

Every returned **packet** carries: answer text, confidence, token count,
provenance (`claim_id` + weight + `source_file`), contradiction count,
input/output sha256 hashes, and the model/compressor version. No packet ships
as anonymous prose (`§2 Rule 3`).

Canonical memory is **file-first**: claims live as Git-versioned markdown in
[`knowledge/`](./knowledge) with structured frontmatter. Generated indexes and
the ledger are derived artifacts.

---

## Layout

```txt
src/lib/memory/    L1–L5 retrieval layers, packet builder, corpus loader
src/lib/ledger/    append-only JSONL event ledger
src/lib/pricing/   packet-based orchestration pricing ($5 / 10K packets)
src/app/           Next.js routes (console, harness, mcp, pricing, …)
knowledge/         canonical markdown memory (the source of truth)
scripts/           CLI entry points for index / query / inspect / export
tests/             vitest coverage for each retrieval layer + ledger
```

---

## Configuration

All paths default to the repo layout; override via env for self-hosting or
tests (`§7 no lock-in`):

| Variable | Default | Purpose |
|---|---|---|
| `MEMRAILS_KNOWLEDGE_DIR` | `./knowledge` | canonical memory location |
| `MEMRAILS_LEDGER_PATH` | `./data/logs/ledger.jsonl` | append-only event ledger |

See [`.env.example`](./.env.example).

---

## Verifying changes

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest run
```

Tests route the ledger to a temp file (`tests/setup.ts`), so running the suite
never touches your real `data/logs/ledger.jsonl`.

### Demo loop

1. `npm run dev`, open `/console-live`.
2. Query `what is the packet contract?` → L1/L2 resolves it cheaply.
3. Query `pricing` with a `summarize` intent → falls through to L5 compress.
4. Confirm the packet shows confidence, provenance weights, and hashes.
5. `npm run ledger:export` to reconcile billed packets against the log.
