// Translation between the editor's text fields and a PDADefinition, plus
// save/load. Keeping this out of the components means the 'q2*' accept-marker
// syntax is defined in exactly one place.

import type { AcceptanceMode, PDADefinition, Transition } from '../types/pda';
import { stripAcceptMarker } from '../engine';

export interface DefinitionDraft {
  /** Comma-separated states; a trailing '*' marks an accept state. */
  states: string;
  inputAlphabet: string;
  stackAlphabet: string;
  initialStackSymbol: string;
  acceptance: AcceptanceMode;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/** Deduplicates while preserving first-seen order. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseDraft(
  draft: DefinitionDraft,
  transitions: Transition[],
  name: string
): PDADefinition {
  const raw = splitList(draft.states);
  const states = unique(raw.map(stripAcceptMarker));
  const acceptStates = unique(
    raw.filter(s => s.endsWith('*')).map(stripAcceptMarker)
  );
  const marker = draft.initialStackSymbol.trim();

  return {
    name,
    states,
    inputAlphabet: unique(splitList(draft.inputAlphabet)),
    stackAlphabet: unique(splitList(draft.stackAlphabet)),
    transitions,
    startState: states[0] ?? '',
    acceptStates,
    initialStackSymbol: marker.length > 0 ? marker : null,
    acceptance: draft.acceptance,
  };
}

/** Renders a definition back into editable text fields. */
export function toDraft(definition: PDADefinition): DefinitionDraft {
  return {
    states: definition.states
      .map(s => (definition.acceptStates.includes(s) ? `${s}*` : s))
      .join(', '),
    inputAlphabet: definition.inputAlphabet.join(', '),
    stackAlphabet: definition.stackAlphabet.join(', '),
    initialStackSymbol: definition.initialStackSymbol ?? '',
    acceptance: definition.acceptance,
  };
}

/** Next unused transition id, so ids stay unique as rows are added and removed. */
export function nextTransitionId(transitions: readonly Transition[]): string {
  let n = transitions.length;
  const taken = new Set(transitions.map(t => t.id));
  while (taken.has(`t${n}`)) n += 1;
  return `t${n}`;
}

interface SerialisedPDA extends Omit<PDADefinition, 'transitions'> {
  transitions: Transition[];
  testString?: string;
}

export function serialiseDefinition(
  definition: PDADefinition,
  testString: string
): string {
  const payload: SerialisedPDA = { ...definition, testString };
  return JSON.stringify(payload, null, 2);
}

export interface LoadResult {
  definition: PDADefinition;
  testString: string;
}

/**
 * Parses a saved config. Accepts files written by earlier versions, which had no
 * transition ids, no bottom-marker field and no acceptance mode.
 */
export function parseDefinitionFile(text: string): LoadResult {
  const data = JSON.parse(text) as Partial<SerialisedPDA> & {
    transitions?: Partial<Transition>[];
  };

  if (!Array.isArray(data.states) || data.states.length === 0) {
    throw new Error('File has no states array.');
  }
  if (!Array.isArray(data.transitions)) {
    throw new Error('File has no transitions array.');
  }

  const states = data.states.map(stripAcceptMarker);
  const transitions: Transition[] = data.transitions.map((t, i) => ({
    id: typeof t.id === 'string' && t.id.length > 0 ? t.id : `t${i}`,
    from: String(t.from ?? ''),
    read: String(t.read ?? 'ε'),
    pop: String(t.pop ?? 'ε'),
    push: String(t.push ?? 'ε'),
    to: String(t.to ?? ''),
  }));

  const acceptance: AcceptanceMode =
    data.acceptance === 'empty-stack' ||
    data.acceptance === 'final-state-and-empty-stack'
      ? data.acceptance
      : 'final-state';

  return {
    definition: {
      name: typeof data.name === 'string' ? data.name : 'Loaded PDA',
      states,
      inputAlphabet: Array.isArray(data.inputAlphabet) ? data.inputAlphabet : [],
      stackAlphabet: Array.isArray(data.stackAlphabet) ? data.stackAlphabet : [],
      transitions,
      startState:
        typeof data.startState === 'string' && data.startState.length > 0
          ? stripAcceptMarker(data.startState)
          : states[0],
      acceptStates: Array.isArray(data.acceptStates)
        ? data.acceptStates.map(stripAcceptMarker)
        : data.states.filter(s => s.endsWith('*')).map(stripAcceptMarker),
      initialStackSymbol:
        data.initialStackSymbol === null
          ? null
          : typeof data.initialStackSymbol === 'string'
          ? data.initialStackSymbol
          : 'Z0',
      acceptance,
    },
    testString: typeof data.testString === 'string' ? data.testString : '',
  };
}
