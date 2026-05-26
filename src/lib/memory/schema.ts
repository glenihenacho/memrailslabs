import { z } from 'zod';

export const QueryInputShape = {
  query: z.string().min(1).max(2000),
  intent: z
    .enum(['answer', 'summarize', 'compare', 'extract', 'refactor', 'route'])
    .optional(),
  max_tokens: z.number().int().positive().max(2000).optional(),
  session_id: z.string().min(1).max(128).optional(),
  endpoint_id: z.string().min(1).max(128).optional(),
};

export const QueryInputSchema = z.object(QueryInputShape);

export const InspectInputShape = {
  packet_id: z.string().min(1).max(128),
};

export const WriteInputShape = {
  claim: z.string().min(1).max(4000),
  evidence: z.array(z.string()).default([]),
  target_file: z.string().optional(),
  stake: z.number().optional(),
};

export const PaymentRailSchema = z.enum([
  'usdc_tempo',
  'stripe_card',
  'visa',
  'lightning',
  'custom',
]);

export const SessionAuthorizeInputShape = {
  budget_cents: z.number().positive().max(1_000_000_000),
  rail: PaymentRailSchema,
  payer_agent_id: z.string().min(1).max(128).optional(),
  endpoint_id: z.string().min(1).max(256).optional(),
};

export const SessionAuthorizeInputSchema = z.object(SessionAuthorizeInputShape);

export const SessionStatusInputShape = {
  session_id: z.string().min(1).max(128),
};

export const EndpointDeployInputShape = {
  corpus_path: z.string().min(1).max(256).optional(),
  payer_agent_id: z.string().min(1).max(128).optional(),
};

export const EndpointDeployInputSchema = z.object(EndpointDeployInputShape);

export const EndpointStatusInputShape = {
  endpoint_id: z.string().min(1).max(128),
};
