import { z } from 'zod';

export const QueryInputShape = {
  query: z.string().min(1).max(2000),
  intent: z
    .enum(['answer', 'summarize', 'compare', 'extract', 'refactor', 'route'])
    .optional(),
  max_tokens: z.number().int().positive().max(2000).optional(),
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
