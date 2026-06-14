---
id: clm_governed_scope
confidence: 0.95
tags: [scope, policy, governance, owner, project, agent, security]
aliases: [governed scope, scope model, policy filter, memory scope]
memory_type: constraint
index_path: /project/project_memrails/retrieval_architecture
summary: Memory is scoped owner → project → agent and gated by a policy layer before retrieval ranks anything.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: Every memory carries an owner → project → agent scope and a status. The policy layer runs before ranking and rejects memory that fails ownership, project scope, agent scope, status (superseded/disputed/tombstoned), restricted sensitivity, or expiry — returning a reason for every rejection so the Console can explain each omission.
---

# Governed Scope & Policy

Policy checks, in order: owner scope → project scope → agent scope →
active-only status → sensitivity → expiry. Agent-scoped memory is visible only
to that agent; project-wide memory (no agent) is visible to every agent in the
project.

Rejections are not silent — each carries a reason (`owner_scope`,
`project_scope`, `agent_scope`, `superseded`, `disputed`,
`restricted_sensitivity`, `expired`, `tombstoned`).
