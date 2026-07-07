/**
 * MemRails TypeScript SDK.
 *
 * Thin HTTP client for local agents. The agent asks for memory and receives a
 * governed context bundle — no local DB, no decryption, no key handling.
 *
 * @example
 * const client = new MemRails({ apiKey: process.env.MEMRAILS_API_KEY });
 * const bundle = await client.memory.retrieve({
 *   agentId: 'agent_local_001',
 *   projectId: 'project_memrails',
 *   taskContext: 'Build the roadmap for MemRails',
 *   maxTokens: 1800,
 * });
 */

import type { ContextBundle, RetrievalMode } from '@/types/bundle';
import type { MemoryRecord } from '@/types/governed';
import type { MemoryMapNode } from '@/types/index-tree';
import type { WriteResult } from '@/lib/memory/write';
import type { FeedbackRecord } from '@/lib/memory/telemetry';

export type MemRailsOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type RetrieveArgs = {
  taskContext: string;
  ownerId?: string;
  projectId?: string;
  agentId?: string;
  maxTokens?: number;
  retrievalMode?: RetrievalMode;
  includeEvidence?: boolean;
  includeDisputed?: boolean;
  includePacket?: boolean;
};

export type WriteArgs = {
  content: string;
  summary?: string;
  ownerId?: string;
  projectId?: string;
  agentId?: string;
  memoryType?: MemoryRecord['memory_type'];
  confidence?: number;
  sensitivity?: MemoryRecord['sensitivity'];
  tags?: string[];
  indexPath?: string;
  /** Validity window: past this ISO instant the record leaves retrieval. */
  expiresAt?: string;
};

export type FeedbackArgs = {
  retrievalId: string;
  rating: 'positive' | 'negative';
  /** Rate one memory of the bundle; omit to rate the whole retrieval. */
  memoryId?: string;
  feedbackType?: string;
  comment?: string;
};

export class MemRails {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MemRailsOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'http://localhost:3000').replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`MemRails ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  readonly memory = {
    retrieve: (args: RetrieveArgs): Promise<ContextBundle> =>
      this.post<ContextBundle>('/api/memory/retrieve', {
        task_context: args.taskContext,
        owner_id: args.ownerId,
        project_id: args.projectId,
        agent_id: args.agentId,
        max_tokens: args.maxTokens,
        retrieval_mode: args.retrievalMode,
        include_evidence: args.includeEvidence,
        include_disputed: args.includeDisputed,
        include_packet: args.includePacket,
      }),

    write: (args: WriteArgs): Promise<WriteResult> =>
      this.post<WriteResult>('/api/memory/write', {
        content: args.content,
        summary: args.summary,
        owner_id: args.ownerId,
        project_id: args.projectId,
        agent_id: args.agentId,
        memory_type: args.memoryType,
        confidence: args.confidence,
        sensitivity: args.sensitivity,
        tags: args.tags,
        index_path: args.indexPath,
        expires_at: args.expiresAt,
      }),

    get: async (memoryId: string): Promise<MemoryRecord> => {
      const id = encodeURIComponent(memoryId);
      const res = await this.fetchImpl(`${this.baseUrl}/api/memory/${id}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`MemRails get failed: ${res.status}`);
      return (await res.json()) as MemoryRecord;
    },

    supersede: (memoryId: string, body: { reason?: string; new_memory?: WriteArgs }) =>
      this.post(`/api/memory/${encodeURIComponent(memoryId)}/supersede`, body),

    dispute: (memoryId: string, reason: string) =>
      this.post(`/api/memory/${encodeURIComponent(memoryId)}/dispute`, { reason }),

    /** §4.4 — dispute is reversible: restore a disputed memory to active. */
    restore: (memoryId: string, body: { reason?: string; confidence?: number } = {}) =>
      this.post<{ memory_id: string; status: 'active'; confidence: number }>(
        `/api/memory/${encodeURIComponent(memoryId)}/restore`,
        body,
      ),

    /** §4.6 — re-score through a versioned, evented transition. */
    updateConfidence: (memoryId: string, body: { confidence: number; reason?: string }) =>
      this.post<{ memory_id: string; confidence: number }>(
        `/api/memory/${encodeURIComponent(memoryId)}/confidence`,
        body,
      ),

    /** §4.5 — tombstone: the memory leaves every future bundle. */
    forget: async (memoryId: string, reason?: string): Promise<unknown> => {
      const id = encodeURIComponent(memoryId);
      const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const res = await this.fetchImpl(`${this.baseUrl}/api/memory/${id}${qs}`, {
        method: 'DELETE',
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`MemRails forget failed: ${res.status} ${await res.text()}`);
      return res.json();
    },

    /** Project memory map — the MemoryIndex as a nested tree. */
    map: async (projectId: string): Promise<{ project_id: string; map: MemoryMapNode[] }> => {
      const res = await this.fetchImpl(
        `${this.baseUrl}/api/memory/map?project_id=${encodeURIComponent(projectId)}`,
        { headers: this.headers() },
      );
      if (!res.ok) throw new Error(`MemRails map failed: ${res.status}`);
      return res.json() as Promise<{ project_id: string; map: MemoryMapNode[] }>;
    },

    /** §6 / no lock-in — pull the governed store (json | jsonl | markdown). */
    export: async (opts: { format?: 'json' | 'jsonl' | 'markdown'; projectId?: string } = {}): Promise<string> => {
      const params = new URLSearchParams();
      if (opts.format) params.set('format', opts.format);
      if (opts.projectId) params.set('project_id', opts.projectId);
      const qs = params.toString() ? `?${params}` : '';
      const res = await this.fetchImpl(`${this.baseUrl}/api/memory/export${qs}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`MemRails export failed: ${res.status}`);
      return res.text();
    },
  };

  /** Close the loop: feedback fans out to the rated bundle's memories (C5). */
  readonly feedback = {
    record: (args: FeedbackArgs): Promise<FeedbackRecord> =>
      this.post<FeedbackRecord>('/api/feedback', {
        retrieval_id: args.retrievalId,
        memory_id: args.memoryId,
        rating: args.rating,
        feedback_type: args.feedbackType,
        comment: args.comment,
      }),
  };
}

export default MemRails;
