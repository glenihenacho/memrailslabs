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
npm test           # 69 passing across retrieval, packet, ledger, refactor, API, MCP
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
| `src/app/api/refactors/` | List, fetch, accept, reject HTTP routes |
| `data/packets/` | One JSON file per packet (gitignored) |
| `data/refactors/` | One JSON file per refactor proposal (gitignored) |
| `data/logs/ledger.jsonl` | Append-only event ledger (gitignored) |
