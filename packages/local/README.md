# @memrails/local

The MemRails **contract v0.1.1 kernel** as an embeddable local runtime: governed
`memory.retrieve()` for locally inferred agents, running in-process against
your own markdown corpus and data directory. File-canonical by default,
Postgres-canonical (embedded PGlite) by flag — both backends pass the same
conformance suite, which is the point.

No lock-in by construction: your memory is markdown + JSONL you can read,
export, and eject with; self-hosted runtimes are **unmetered by default**
(usage reports zero unless you install a meter).

## Quickstart

```ts
import { write, retrieve, supersede, exportRecords, projectMarkdown, flushAuthority } from '@memrails/local';

write({ content: 'We chose PageIndex-style tree retrieval over vector top-k.', tags: ['decision'], confidence: 0.9 });

const bundle = retrieve({ task_context: 'why not vector top-k?' });
// bundle.memories        — scored, explained, policy-gated
// bundle.omitted         — every exclusion carries a reason
// bundle.retrieval_trace — mode, branches, filters, planner (name@version)

await flushAuthority(); // durable before exit
```

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `MEMRAILS_DATA_DIR` | `<cwd>/data` | writable store (overlay, JSONL logs, artifacts) |
| `MEMRAILS_KNOWLEDGE_DIR` | `<cwd>/knowledge` | canonical markdown corpus; missing dir = empty corpus |
| `MEMRAILS_AUTHORITY` | `file` | `file` \| `postgres` \| `dual` |
| `MEMRAILS_PG_DIR` | `<data>/pg` | PGlite directory (`:memory:` for ephemeral) |
| `MEMRAILS_PLANNER` | eval-promoted default | `heuristic` \| `corpus` \| any registered planner |

## Surface

- **Core primitive**: `retrieve(input) → ContextBundle`; governed `write`
- **Governance (§4)**: `supersede`, `dispute`, `restore`, `updateConfidence`, `forget` — every transition versioned + evented
- **Portability (§6)**: `exportRecords` / `importRecords` (JSONL, round-trip law)
- **Projection (§7)**: `projectMarkdown` → derived `memrails.md`
- **Quality loop**: `recordFeedback`, `reverifyStaleness`, `runEvals` + gates
- **Planner seam (§9/v0.1.1)**: `registerPlanner`, `planBranches`; trace names every plan
- **Ledger (§8)**: `readLedger`
- **Metering seam (§5.8)**: `setRetrievalMeter` (unmetered until installed)

## Conformance

This package is built from the reference implementation's kernel. Certification
is the conformance suite (`tests/conformance/` in the repository), run against
both the file and Postgres authorities, plus the cross-runtime round-trip test
— see the conformance kit README for the procedure and the test → contract-§
mapping.

## Build

From the repository root:

```bash
npm run package:local    # tsup → dist (ESM + CJS + bundled d.ts)
npm run package:verify   # build + smoke the built artifact in a clean temp dir
```
