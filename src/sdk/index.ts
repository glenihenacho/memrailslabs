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
import type { WriteResult } from '@/lib/memory/write';

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
  tags?: string[];
  indexPath?: string;
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
        tags: args.tags,
        index_path: args.indexPath,
      }),

    get: async (memoryId: string): Promise<MemoryRecord> => {
      const res = await this.fetchImpl(`${this.baseUrl}/api/memory/${memoryId}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`MemRails get failed: ${res.status}`);
      return (await res.json()) as MemoryRecord;
    },

    supersede: (memoryId: string, body: { reason?: string; new_memory?: WriteArgs }) =>
      this.post(`/api/memory/${memoryId}/supersede`, body),

    dispute: (memoryId: string, reason: string) =>
      this.post(`/api/memory/${memoryId}/dispute`, { reason }),
  };
}

export default MemRails;
