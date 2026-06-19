---
id: clm_auth
confidence: 0.93
tags: [auth, api-key, security, ownership, tenant, governance]
aliases: [authentication, api key, bearer auth, ownership check]
memory_type: constraint
index_path: /project/project_memrails/retrieval_architecture
summary: API-key auth derives the owner from the key (never the request body); writes/lifecycle require a real key; unauthenticated requests are a read-only demo tenant.
created_at: 2026-06-15
updated_at: 2026-06-15
claim: The memory API authenticates with API keys. The owner is derived from the Authorization Bearer key, never trusted from the request body or query, so a tenant can only reach its own namespace. Mutations (write, supersede, dispute, forget) require a real key; an unknown key is rejected with 401. With no key, requests resolve to a read-only demo tenant (user_memrails, the curated corpus). Memory ids and retrieval ids return 404 when not owned, so existence never leaks across tenants. Enrollment can be gated with MEMRAILS_ENROLL_TOKEN to prevent open credential issuance.
---

# Authentication & Ownership

- **Identity** — `Authorization: Bearer <api_key>` → owner (via `api_key_hash`).
  The owner is never taken from the body/query.
- **Demo tenant** — no key → `user_memrails`, read-only, so the console works
  without credentials. Mutations require a real key (401 otherwise).
- **Ownership** — `[id]`, `supersede`, `dispute`, and retrieval traces verify
  the target belongs to the caller; not-found and not-owned both return 404.
- **Reads are scoped** — retrieve, export, map, usage, and the ledger are
  filtered to the caller's tenant; `/api/stack` is public.
- **Enrollment gate** — `MEMRAILS_ENROLL_TOKEN` (`x-enroll-token`) blocks open
  credential issuance in production.

Code: `src/lib/auth/authenticate.ts`, `src/lib/accounts/store.ts`
(`findByApiKey`). Tests: `tests/auth/auth.test.ts`.
