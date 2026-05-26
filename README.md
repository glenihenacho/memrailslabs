# MemRails

Knowledge density infrastructure for agentic software. The retrieval stack
(L1 grep → L2 key → L3 semantic → L4 evidence → L5 compress) emits
inspectable packets with provenance and hashes. See `CLAUDE.md` for the
full constitution.

## Quick start

```sh
npm install
npm run memory:index
npm run memory:query -- "what is the packet contract?"
npm run dev   # then visit /console-live
```

## Verification commands

```sh
npm test           # 98 passing across retrieval, packet, ledger, refactor, payments, API, MCP
npm run typecheck
npm run lint
npm run build
```

## Use MemRails from Claude Code (MCP)

The MCP server exposes three tools (`memory.query`, `memory.inspect`,
`memory.write`) and two resources (`memory://files/<path>`,
`memory://keys/index.json`) over stdio. Every call lands in the JSONL
ledger as `MCP_TOOL_CALL`, so the Console (`/console-live`) keeps the
audit trail.

Register the server in your Claude Code settings:

```json
{
  "mcpServers": {
    "memrails": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/memrailslabs/scripts/mcp-stdio.ts"]
    }
  }
}
```

Then `/mcp` inside Claude Code should list `memrails` with three tools
and two resource roots. `memory.write` returns a reviewable refactor
proposal (per §2 Rule 4 it never mutates canonical memory silently).

## Sessions & billing

Packets are priced at the orchestration baseline ($5/10K = $0.0005 per
packet, per §11). Agents authorize a payment session up front and stream
packets against it; each billed packet emits an off-chain voucher into
the same JSONL ledger.

```sh
# 1. authorize a $2 session paid on the stripe_card rail
curl -s -X POST http://localhost:3000/api/sessions \
  -H 'content-type: application/json' \
  -d '{"budget_cents": 200, "rail": "stripe_card"}'
# → { "session_id": "sess_…", "remaining_cents": 200, ... }

# 2. query with the session_id — the packet response stays unchanged
curl -s -X POST http://localhost:3000/api/memory/query \
  -H 'content-type: application/json' \
  -d '{"query":"what is the packet contract?","session_id":"sess_…"}'

# 3. inspect the voucher trail
npm run ledger:export | grep PACKET_BILLED
# → debit_cents 0.05, remaining_cents 199.95, rail stripe_card
```

Over MCP, agents call `memory.session.authorize` to mint the session,
then attach `session_id` to every `memory.query`. `memory.session.status`
returns the current `PaymentSession`. When remaining drops below the
per-packet cost, the session flips to `exhausted` and the next call
returns HTTP `402 payment_required` (or `isError: true` over MCP).
`POST /api/sessions/<id>/close` terminates an active session. Sessions
persist as plain JSON under `data/sessions/<id>.json` — no opaque
storage.

The Console (`/console-live`) renders the live billing ledger:
authorize from the form, click a session to inspect its voucher rows
(packet · debit · remaining · time), toggle "bill against session" on
the query form to start streaming, and export the full audit trail
via the JSONL link.

## Refactor proposals

`memory.write` creates an `ADD_CLAIM` proposal under `data/refactors/`
and emits a `REFACTOR_PROPOSED` ledger event. Review the unified diff
in the Console (`/console-live` → refactor feed) or via
`GET /api/refactors`, then `POST /api/refactors/<id>/accept` to write
the markdown file into `knowledge/claims/`, or
`POST /api/refactors/<id>/reject` to dismiss it. Accept reloads the
corpus in place so the next query sees the new claim.

### Smoke test without Claude Code

```sh
npm run mcp:stdio < smoke.jsonl > out.jsonl
```

where `smoke.jsonl` contains an `initialize` request, the
`notifications/initialized` notification, and any `tools/list`,
`tools/call`, `resources/list`, or `resources/read` call.

## Project layout

| Path | Purpose |
|---|---|
| `knowledge/` | Canonical markdown corpus (file-canonical per §2 Rule 1) |
| `src/lib/memory/` | L1–L5 retrieval stack + packet store |
| `src/lib/mcp/` | MCP server, tool handlers, resource handlers |
| `src/lib/ledger/` | JSONL append-only event log |
| `src/app/console-live/` | Functional console with query + inspector |
| `src/marketing/` | Extracted marketing HTML (rendered by `/app/*`) |
| `scripts/mcp-stdio.ts` | Stdio entry point for the MCP server |
| `src/lib/refactor/` | Proposal builder, validator, store, unified-diff renderer |
| `src/lib/payments/` | Payment session lifecycle, voucher debits, cost source |
| `src/app/api/refactors/` | List, fetch, accept, reject HTTP routes |
| `src/app/api/sessions/` | Authorize, list, fetch, close session HTTP routes |
| `data/packets/` | One JSON file per packet (gitignored) |
| `data/refactors/` | One JSON file per refactor proposal (gitignored) |
| `data/sessions/` | One JSON file per payment session (gitignored) |
| `data/logs/ledger.jsonl` | Append-only event ledger (gitignored) |
