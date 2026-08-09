// Built-in example machines.
//
// The three DPDA examples keep the semantics the visualiser has always used:
// a 'Z0' bottom marker, pushes written top-symbol-first ('AZ0'), and acceptance
// by final state with all input consumed.
//
// The NPDA examples are chosen because they genuinely need nondeterminism —
// running them in DPDA mode rejects strings the language contains, which is the
// clearest way to show what the two modes actually differ on.

import type { ExecutionMode, PDADefinition, Transition } from '../types/pda';

type Tuple = [from: string, read: string, pop: string, push: string, to: string];

/** Assigns stable ids so the UI can key rows and highlight conflicts. */
export function buildTransitions(tuples: Tuple[], prefix = 't'): Transition[] {
  return tuples.map(([from, read, pop, push, to], i) => ({
    id: `${prefix}${i}`,
    from,
    read,
    pop,
    push,
    to,
  }));
}

export interface Example {
  key: string;
  definition: PDADefinition;
  /** The mode this machine is meant to be run in. */
  mode: ExecutionMode;
  description: string;
  testString: string;
  /** Extra strings offered as one-click tests. */
  alsoTry: string[];
}

const balanced: Example = {
  key: 'balanced',
  mode: 'dpda',
  description: 'Balanced parentheses',
  testString: '(())',
  alsoTry: ['()()', '(()', ''],
  definition: {
    name: 'Balanced Parentheses',
    states: ['q0', 'q2'],
    inputAlphabet: ['(', ')'],
    stackAlphabet: ['Z0', 'A'],
    startState: 'q0',
    acceptStates: ['q2'],
    initialStackSymbol: 'Z0',
    acceptance: 'final-state',
    transitions: buildTransitions([
      ['q0', '(', 'Z0', 'AZ0', 'q0'],
      ['q0', '(', 'A', 'AA', 'q0'],
      ['q0', ')', 'A', 'ε', 'q0'],
      ['q0', 'ε', 'Z0', 'ε', 'q2'],
    ], 'bal'),
  },
};

const anbn: Example = {
  key: 'anbn',
  mode: 'dpda',
  description: 'aⁿbⁿ — equal a’s then b’s',
  testString: 'aabb',
  alsoTry: ['aaabbb', 'aab', 'ab'],
  definition: {
    name: 'aⁿbⁿ Language',
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['Z0', 'A'],
    startState: 'q0',
    acceptStates: ['q2'],
    initialStackSymbol: 'Z0',
    acceptance: 'final-state',
    transitions: buildTransitions([
      ['q0', 'a', 'Z0', 'AZ0', 'q0'],
      ['q0', 'a', 'A', 'AA', 'q0'],
      ['q0', 'b', 'A', 'ε', 'q1'],
      ['q1', 'b', 'A', 'ε', 'q1'],
      ['q1', 'ε', 'Z0', 'Z0', 'q2'],
    ], 'anbn'),
  },
};

const palindrome: Example = {
  key: 'palindrome',
  mode: 'dpda',
  description: 'wcwᴿ — palindrome with a centre marker',
  testString: 'abcba',
  alsoTry: ['aacaa', 'abcab', 'c'],
  definition: {
    name: 'wcwᴿ Palindrome',
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b', 'c'],
    stackAlphabet: ['Z0', 'A', 'B'],
    startState: 'q0',
    acceptStates: ['q2'],
    initialStackSymbol: 'Z0',
    acceptance: 'final-state',
    transitions: buildTransitions([
      ['q0', 'a', 'Z0', 'AZ0', 'q0'],
      ['q0', 'a', 'A', 'AA', 'q0'],
      ['q0', 'a', 'B', 'AB', 'q0'],
      ['q0', 'b', 'Z0', 'BZ0', 'q0'],
      ['q0', 'b', 'A', 'BA', 'q0'],
      ['q0', 'b', 'B', 'BB', 'q0'],
      ['q0', 'c', 'ε', 'ε', 'q1'],
      ['q1', 'a', 'A', 'ε', 'q1'],
      ['q1', 'b', 'B', 'ε', 'q1'],
      ['q1', 'ε', 'Z0', 'Z0', 'q2'],
    ], 'pal'),
  },
};

/**
 * wwᴿ — even-length palindromes with no centre marker.
 *
 * The machine cannot see the midpoint, so it must guess when to stop pushing and
 * start matching. In DPDA mode the consuming-move-first rule pushes the entire
 * string and the guess never fires in time, so 'abba' is rejected; NPDA mode
 * explores every midpoint and accepts.
 */
const evenPalindrome: Example = {
  key: 'evenPalindrome',
  mode: 'npda',
  description: 'wwᴿ — even palindromes, midpoint guessed',
  testString: 'abba',
  alsoTry: ['aabbaa', 'abab', 'ab', ''],
  definition: {
    name: 'wwᴿ Even Palindrome',
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['Z0', 'A', 'B'],
    startState: 'q0',
    acceptStates: ['q2'],
    initialStackSymbol: 'Z0',
    acceptance: 'final-state',
    transitions: buildTransitions([
      // Push phase.
      ['q0', 'a', 'Z0', 'AZ0', 'q0'],
      ['q0', 'a', 'A', 'AA', 'q0'],
      ['q0', 'a', 'B', 'AB', 'q0'],
      ['q0', 'b', 'Z0', 'BZ0', 'q0'],
      ['q0', 'b', 'A', 'BA', 'q0'],
      ['q0', 'b', 'B', 'BB', 'q0'],
      // Guess that the midpoint is here.
      ['q0', 'ε', 'Z0', 'Z0', 'q1'],
      ['q0', 'ε', 'A', 'A', 'q1'],
      ['q0', 'ε', 'B', 'B', 'q1'],
      // Match the second half against the stack.
      ['q1', 'a', 'A', 'ε', 'q1'],
      ['q1', 'b', 'B', 'ε', 'q1'],
      ['q1', 'ε', 'Z0', 'Z0', 'q2'],
    ], 'ww'),
  },
};

/**
 * aⁱbʲcᵏ with i=j or j=k — a union that no DPDA recognises.
 *
 * Two ε-moves leave q0 on the same stack top, one per disjunct, so the machine
 * must commit before it has seen enough input to know which test will hold. That
 * is a hard determinism conflict, and the DPDA check reports it as such.
 */
const aibjck: Example = {
  key: 'aibjck',
  mode: 'npda',
  description: 'aⁱbʲcᵏ where i=j or j=k',
  testString: 'aabbc',
  alsoTry: ['abbcc', 'abbc', 'aabbcc', 'abc'],
  definition: {
    name: 'aⁱbʲcᵏ (i=j or j=k)',
    states: ['q0', 'p0', 'p1', 'p2', 'p3', 'r0', 'r1', 'r2', 'r3'],
    inputAlphabet: ['a', 'b', 'c'],
    stackAlphabet: ['Z0', 'A', 'B'],
    startState: 'q0',
    acceptStates: ['p3', 'r3'],
    initialStackSymbol: 'Z0',
    acceptance: 'final-state',
    transitions: buildTransitions([
      // The guess: which disjunct are we proving?
      ['q0', 'ε', 'Z0', 'Z0', 'p0'],
      ['q0', 'ε', 'Z0', 'Z0', 'r0'],
      // Branch p — count a's against b's, then ignore the c's.
      ['p0', 'a', 'Z0', 'AZ0', 'p0'],
      ['p0', 'a', 'A', 'AA', 'p0'],
      ['p0', 'ε', 'Z0', 'Z0', 'p1'],
      ['p0', 'ε', 'A', 'A', 'p1'],
      ['p1', 'b', 'A', 'ε', 'p1'],
      ['p1', 'ε', 'Z0', 'Z0', 'p2'],
      ['p2', 'c', 'Z0', 'Z0', 'p2'],
      ['p2', 'ε', 'Z0', 'Z0', 'p3'],
      // Branch r — ignore the a's, then count b's against c's.
      ['r0', 'a', 'Z0', 'Z0', 'r0'],
      ['r0', 'ε', 'Z0', 'Z0', 'r1'],
      ['r1', 'b', 'Z0', 'BZ0', 'r1'],
      ['r1', 'b', 'B', 'BB', 'r1'],
      ['r1', 'ε', 'Z0', 'Z0', 'r2'],
      ['r1', 'ε', 'B', 'B', 'r2'],
      ['r2', 'c', 'B', 'ε', 'r2'],
      ['r2', 'ε', 'Z0', 'Z0', 'r3'],
    ], 'ijk'),
  },
};

export const examples: Example[] = [
  balanced,
  anbn,
  palindrome,
  evenPalindrome,
  aibjck,
];

export const exampleByKey: Record<string, Example> = Object.fromEntries(
  examples.map(example => [example.key, example])
);

/** Deep copy so editing a loaded example never mutates the built-in table. */
export function cloneDefinition(definition: PDADefinition): PDADefinition {
  return {
    ...definition,
    states: [...definition.states],
    inputAlphabet: [...definition.inputAlphabet],
    stackAlphabet: [...definition.stackAlphabet],
    acceptStates: [...definition.acceptStates],
    transitions: definition.transitions.map(t => ({ ...t })),
  };
}
