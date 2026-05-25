export type EvidenceClaim = {
  id: string;
  source_file: string;
  source_span?: {
    start_line?: number;
    end_line?: number;
    selector?: string;
  };
  claim: string;
  confidence: number;
  evidence_urls?: string[];
  contradictions?: string[];
  tags: string[];
  aliases?: string[];
  created_at: string;
  updated_at: string;
};
