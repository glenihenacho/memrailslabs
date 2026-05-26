import type { HarnessConfig, Integration } from '@/types/endpoint';

export const BASELINE_CONFIG: HarnessConfig = {
  retrieval: ['grep', 'key', 'semantic', 'evidence', 'compress'],
  compress: {
    model: 'compress-v1',
    max_tokens: 600,
    fidelity_floor: 0.85,
  },
  evidence: {
    min_confidence: 0.75,
    citation_density: 'balanced',
  },
  integrations: 'auto',
};

export const INTEGRATIONS: Integration[] = [
  { id: 'claude_code', label: 'Claude Code', prewired: true },
  { id: 'openclaw', label: 'OpenClaw', prewired: true },
  { id: 'opencode', label: 'OpenCode', prewired: true },
  { id: 'cursor', label: 'Cursor', prewired: false },
  { id: 'codex', label: 'Codex', prewired: false },
  { id: 'langgraph', label: 'LangGraph', prewired: false },
  { id: 'crewai', label: 'CrewAI', prewired: false },
  { id: 'n8n', label: 'n8n', prewired: false },
  { id: 'mcp', label: 'MCP', prewired: false },
];

export const COMPRESSOR_ID = 'compress-v1';
