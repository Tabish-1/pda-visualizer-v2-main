// Static analysis of a PDA definition: structural validation, determinism
// checking, and reachability. All of this runs without simulating any input.

import {
  type DeterminismConflict,
  type DeterminismReport,
  type PDADefinition,
  type Transition,
  type ValidationIssue,
} from '../types/pda';
import { displaySymbol, isEpsilon } from './symbols';

/** δ(state, read, pop) in display form, for messages. */
export function formatTrigger(state: string, read: string, pop: string): string {
  return `δ(${state}, ${displaySymbol(read)}, ${displaySymbol(pop)})`;
}

/** Full transition in display form: δ(q, a, X) → (p, YZ). */
export function formatTransition(t: Transition): string {
  return `${formatTrigger(t.from, t.read, t.pop)} → (${t.to}, ${displaySymbol(t.push)})`;
}

/** The compact edge-label form asked for by the UI: `read, pop → push`. */
export function formatTransitionLabel(t: Transition): string {
  return `${displaySymbol(t.read)}, ${displaySymbol(t.pop)} → ${displaySymbol(t.push)}`;
}

/**
 * Two transitions from the same state compete if their read symbols can apply
 * to the same next input symbol and their pop symbols can apply to the same
 * stack top. An epsilon read matches any position, and an epsilon pop matches
 * any stack top, so epsilon widens rather than narrows the overlap.
 */
function triggersOverlap(a: Transition, b: Transition): boolean {
  const readOverlap =
    isEpsilon(a.read) || isEpsilon(b.read) || a.read === b.read;
  const popOverlap = isEpsilon(a.pop) || isEpsilon(b.pop) || a.pop === b.pop;
  return readOverlap && popOverlap;
}

/**
 * Classifies every overlapping transition pair.
 *
 * A `hard` conflict is two input-consuming transitions competing on the same
 * trigger — irreducible nondeterminism that DPDA mode cannot resolve.
 *
 * A `soft` conflict pits an epsilon move against a consuming move. DPDA mode
 * resolves these with the standard convention that an epsilon move is only
 * taken when no consuming move applies. All three built-in examples rely on
 * this (their accept step is an epsilon move out of a state that also has
 * consuming loops), so treating soft overlaps as fatal would wrongly classify
 * textbook DPDAs as nondeterministic.
 */
export function analyseDeterminism(definition: PDADefinition): DeterminismReport {
  const conflicts: DeterminismConflict[] = [];
  const byState = new Map<string, Transition[]>();

  for (const t of definition.transitions) {
    const list = byState.get(t.from);
    if (list) list.push(t);
    else byState.set(t.from, [t]);
  }

  for (const [state, group] of byState) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (!triggersOverlap(a, b)) continue;

        const aEpsilon = isEpsilon(a.read);
        const bEpsilon = isEpsilon(b.read);
        // Two consuming moves on the same symbol, or two ε-moves on the same
        // stack top, are both irreducible: no priority rule picks between them.
        const bothConsume = !aEpsilon && !bEpsilon;
        const bothEpsilon = aEpsilon && bEpsilon;
        const kind: DeterminismConflict['kind'] =
          bothConsume || bothEpsilon ? 'hard' : 'soft';

        let description: string;
        if (bothConsume) {
          description =
            `${formatTrigger(state, a.read, a.pop)} has two competing moves: ` +
            `${formatTransition(a)} and ${formatTransition(b)}.`;
        } else if (bothEpsilon) {
          description =
            `${state} has two ε-moves on the same stack top: ` +
            `${formatTransition(a)} and ${formatTransition(b)}. ` +
            `Nothing distinguishes them, so this needs NPDA mode.`;
        } else {
          description =
            `${formatTransition(a)} overlaps ${formatTransition(b)} via an ε-move. ` +
            `DPDA mode resolves this by taking the ε-move only when no ` +
            `input-consuming move applies — legal for a DPDA, but it can accept ` +
            `a smaller language than NPDA mode does.`;
        }

        conflicts.push({
          kind,
          state,
          read: bothConsume ? a.read : displaySymbol(a.read),
          pop: a.pop,
          transitionIds: [a.id, b.id],
          description,
        });
      }
    }
  }

  return {
    isDeterministic: conflicts.every(c => c.kind === 'soft'),
    conflicts,
  };
}

/**
 * Structural checks. Errors mean the definition cannot be simulated meaningfully;
 * warnings are things worth surfacing but safe to run with.
 */
export function validateDefinition(definition: PDADefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const states = new Set(definition.states);

  if (definition.states.length === 0) {
    issues.push({ severity: 'error', message: 'No states defined.' });
  }

  if (!definition.startState) {
    issues.push({ severity: 'error', message: 'No start state set.' });
  } else if (!states.has(definition.startState)) {
    issues.push({
      severity: 'error',
      message: `Start state "${definition.startState}" is not in the state set.`,
    });
  }

  const duplicates = definition.states.filter(
    (s, i) => definition.states.indexOf(s) !== i
  );
  for (const duplicate of new Set(duplicates)) {
    issues.push({ severity: 'warning', message: `State "${duplicate}" is listed twice.` });
  }

  for (const accept of definition.acceptStates) {
    if (!states.has(accept)) {
      issues.push({
        severity: 'error',
        message: `Accept state "${accept}" is not in the state set.`,
      });
    }
  }

  if (
    definition.acceptStates.length === 0 &&
    definition.acceptance !== 'empty-stack'
  ) {
    issues.push({
      severity: 'warning',
      message:
        'No accept states, so nothing can be accepted. Mark one with * or switch to empty-stack acceptance.',
    });
  }

  for (const t of definition.transitions) {
    if (!states.has(t.from)) {
      issues.push({
        severity: 'error',
        message: `Transition ${formatTransition(t)} starts from unknown state "${t.from}".`,
        transitionIds: [t.id],
      });
    }
    if (!states.has(t.to)) {
      issues.push({
        severity: 'error',
        message: `Transition ${formatTransition(t)} targets unknown state "${t.to}".`,
        transitionIds: [t.id],
      });
    }
    if (
      !isEpsilon(t.read) &&
      definition.inputAlphabet.length > 0 &&
      !definition.inputAlphabet.includes(t.read)
    ) {
      issues.push({
        severity: 'warning',
        message: `Transition ${formatTransition(t)} reads "${t.read}", which is not in the input alphabet.`,
        transitionIds: [t.id],
      });
    }
    if (
      !isEpsilon(t.pop) &&
      definition.stackAlphabet.length > 0 &&
      !definition.stackAlphabet.includes(t.pop)
    ) {
      issues.push({
        severity: 'warning',
        message: `Transition ${formatTransition(t)} pops "${t.pop}", which is not in the stack alphabet.`,
        transitionIds: [t.id],
      });
    }
  }

  // Input is consumed one character at a time, so a multi-character input symbol
  // can never match and any transition reading it is dead.
  const multiCharInput = definition.inputAlphabet.filter(s => s.length > 1);
  for (const symbol of multiCharInput) {
    const users = definition.transitions.filter(t => t.read === symbol);
    issues.push({
      severity: 'warning',
      message:
        `Input symbol "${symbol}" is more than one character. Input is read one ` +
        `character at a time, so ${
          users.length > 0
            ? `${users.length} transition${users.length === 1 ? '' : 's'} reading it can never fire.`
            : 'it can never be matched.'
        }`,
      transitionIds: users.map(t => t.id),
    });
  }

  // Pushes are split against the stack alphabet. Symbols that appear only in a
  // push are unknown to the tokenizer and get split per character, so a push like
  // 'AZ0' would silently become A, Z, 0. Inference covers popped symbols and the
  // bottom marker; anything left is genuinely ambiguous and must be declared.
  const knownStackSymbols = new Set([
    ...definition.stackAlphabet,
    ...(definition.initialStackSymbol === null ? [] : [definition.initialStackSymbol]),
    ...definition.transitions.filter(t => !isEpsilon(t.pop)).map(t => t.pop),
  ]);
  const ambiguousPushes = definition.transitions.filter(t => {
    if (isEpsilon(t.push)) return false;
    let rest = t.push;
    while (rest.length > 0) {
      const match = [...knownStackSymbols]
        .filter(s => s.length > 0)
        .sort((a, b) => b.length - a.length)
        .find(s => rest.startsWith(s));
      if (!match) return true;
      rest = rest.slice(match.length);
    }
    return false;
  });
  if (ambiguousPushes.length > 0) {
    issues.push({
      severity: 'warning',
      message:
        `${ambiguousPushes.length} transition${
          ambiguousPushes.length === 1 ? '' : 's'
        } push symbols that are not in the stack alphabet and are never popped ` +
        `(e.g. ${formatTransition(ambiguousPushes[0])}). Multi-character symbols ` +
        `there will be split one character per stack cell. Add them to the stack alphabet.`,
      transitionIds: ambiguousPushes.map(t => t.id),
    });
  }

  const reachable = reachableStates(definition);
  for (const state of definition.states) {
    if (!reachable.has(state)) {
      issues.push({
        severity: 'warning',
        message: `State "${state}" is unreachable from the start state.`,
      });
    }
  }

  return issues;
}

/** Checks an input string against the declared input alphabet. */
export function validateInput(
  definition: PDADefinition,
  input: string
): ValidationIssue[] {
  if (definition.inputAlphabet.length === 0) return [];

  const unknown = [...new Set(input.split(''))].filter(
    ch => !definition.inputAlphabet.includes(ch)
  );

  if (unknown.length === 0) return [];

  return [
    {
      severity: 'warning',
      message: `Input contains ${unknown
        .map(c => `"${c}"`)
        .join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not in the input alphabet.`,
    },
  ];
}

/** States reachable from the start state by ignoring stack contents. */
export function reachableStates(definition: PDADefinition): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const t of definition.transitions) {
    const list = adjacency.get(t.from);
    if (list) list.push(t.to);
    else adjacency.set(t.from, [t.to]);
  }

  const seen = new Set<string>();
  const queue = [definition.startState];

  while (queue.length > 0) {
    const state = queue.shift() as string;
    if (seen.has(state)) continue;
    seen.add(state);
    for (const next of adjacency.get(state) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }

  return seen;
}
