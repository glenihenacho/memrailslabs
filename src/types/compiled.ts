/**
 * Prompt-compiled, made-to-order index over a time slice.
 *
 * The synthesis of `retrieve` (prompt relevance) and the timeline (completeness
 * + time): build a fresh index over ONLY the in-window memory, organize it
 * around the prompt, and return everything — sections ordered by relevance to
 * the question, nothing dropped. Still select-&-organize: relevance is a
 * deterministic lexical projection over canonical records, never generation.
 */

import type { TimelineEntry, TimelineMode } from './timeline';

export type CompiledEntry = TimelineEntry & {
  /** Lexical relevance of this record to the prompt, in [0, 1]. */
  relevance: number;
};

export type CompiledSection = {
  path: string;
  title: string;
  /** Section relevance to the prompt (max of member relevances). */
  relevance: number;
  entries: CompiledEntry[];
};

export type CompileInput = {
  owner_id?: string;
  project_id?: string;
  task_context: string;
  from?: string;
  to?: string;
  as_of?: string;
};

export type CompiledView = {
  scope: { owner_id: string; project_id?: string };
  contract: 'completeness';
  query: string;
  mode: TimelineMode;
  from?: string;
  to?: string;
  as_of?: string;
  /** Every in-window record — completeness, no prune. */
  total: number;
  /** How many of those scored above zero relevance to the prompt. */
  total_relevant: number;
  /** Sections ordered by relevance to the prompt; entries likewise. */
  sections: CompiledSection[];
  compiled_at: string;
  trace: {
    records_in_window: number;
    sections: number;
    top_section?: string;
  };
};
