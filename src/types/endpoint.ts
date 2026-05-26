export type EndpointStatus = 'provisioning' | 'live' | 'paused' | 'closed';

export type DeployStepName =
  | 'provision_openclaw'
  | 'index_knowledge'
  | 'apply_config'
  | 'bind_compress'
  | 'wire_integrations';

export type DeployStep = {
  name: DeployStepName;
  status: 'ok' | 'failed';
  latency_ms: number;
  note?: string;
};

export type Integration = {
  id: string;
  label: string;
  prewired: boolean;
};

export type HarnessConfig = {
  retrieval: ['grep', 'key', 'semantic', 'evidence', 'compress'];
  compress: {
    model: 'compress-v1';
    max_tokens: 600;
    fidelity_floor: 0.85;
  };
  evidence: {
    min_confidence: 0.75;
    citation_density: 'balanced';
  };
  integrations: 'auto';
};

export type Endpoint = {
  endpoint_id: string;
  url: string;
  status: EndpointStatus;
  corpus_path: string;
  corpus_keys: number;
  compressor: string;
  config: HarnessConfig;
  integrations: Integration[];
  deploy_log: DeployStep[];
  payer_agent_id?: string;
  created_at: string;
  updated_at: string;
};
