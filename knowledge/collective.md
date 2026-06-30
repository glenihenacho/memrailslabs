---
id: clm_collective
confidence: 0.9
tags: [collective, predictive, cross-tenant, opt-in, privacy, k-anonymity, insights]
aliases: [collective, predictive insights, cross-tenant, opt-in collective, living graph]
memory_type: decision
index_path: /project/project_memrails/data_model
summary: The collective is an opt-in, reciprocal, k-anonymous cross-tenant plane — predictive insights from tags/topics + counts across consenting tenants, never another tenant's content.
created_at: 2026-06-19
updated_at: 2026-06-19
claim: MemRails offers cross-tenant predictive insights via the collective, a global plane that aggregates only across tenants who have explicitly consented (collective_opt_in, default off, server-authoritative — a cookie is only the client mirror). It is reciprocal — only opted-in tenants contribute and only opted-in tenants receive. Insights are aggregate-only (tags/topics + counts), never another tenant's note bodies, ids, or scope, and are k-anonymous — surfaced only when backed by at least k distinct other opted-in tenants (default 3). Prediction is deterministic and grounded in real co-occurrence; generative synthesis is a separate, future opt-in.
---

# The Collective — cross-tenant predictive insights

The vision: *a living graph of name-spaced notes, with predictive insights
amongst the collective.* The collective is how the per-tenant graphs inform
each other — **by consent, in aggregate, never by exposure.**

## Invariants (structural, not bolted on)

- **Opt-in & reciprocal.** `collective_opt_in` defaults **off**. Only consenting
  tenants contribute, and only consenting tenants receive (`403` otherwise).
  Consent is server-authoritative; a browser cookie is only a UX mirror.
- **Aggregate-only.** Insights are derived from **tags/topics + counts**. No
  tenant ever sees another tenant's note bodies, ids, or scope.
- **k-anonymous.** A signal surfaces only when backed by **≥ k distinct *other*
  opted-in tenants** (default `k = 3`), so no single tenant leaks through an
  "aggregate."
- **Deterministic & grounded.** v1 is co-occurrence link prediction — "you have
  topic A; topic B co-occurs with A across the collective; consider B." Real
  signal, no generation.

## Plane & API

A **global** plane (like authority / telemetry / analytics), distinct from the
per-owner federation that stays isolated.

- `POST /api/collective/opt-in` `{ "opt_in": true|false }` — consent (real key).
- `GET /api/collective/insights` — opted-in only; returns aggregate topic
  predictions + `collective_size` + `support_threshold`.

## Honest limits

- v1 keys on **tags** only; richer signals (link/contradiction prediction,
  embeddings) are extensions — still aggregate + k-anonymous.
- **Generative** collective synthesis is deliberately out until separately
  designed with guardrails; the moat is grounded, traceable insight.

Code: `src/lib/memory/collective.ts`, `src/lib/accounts/store.ts`
(`collective_opt_in`), `src/app/api/collective/*`.
Tests: `tests/collective/collective.test.ts`.
