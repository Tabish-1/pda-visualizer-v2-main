// Exercises the path a hand-built PDA actually takes: editor text fields ->
// parseDraft -> simulate. The built-in examples bypass parseDraft entirely, so
// without these the custom-machine flow would be untested.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transition } from '../../types/pda';
import {
  nextTransitionId,
  parseDefinitionFile,
  parseDraft,
  serialiseDefinition,
  toDraft,
  type DefinitionDraft,
} from '../../lib/definition';
import { analyseDeterminism, validateDefinition } from '../analysis';
import { exampleByKey } from '../examples';
import { simulate } from '../simulate';

const draft: DefinitionDraft = {
  states: 'q0, q1, q2*',
  inputAlphabet: 'a, b',
  stackAlphabet: 'Z0, A',
  initialStackSymbol: 'Z0',
  acceptance: 'final-state',
};

/** Builds transitions the way the editor does, one field at a time. */
function rows(tuples: [string, string, string, string, string][]): Transition[] {
  const out: Transition[] = [];
  for (const [from, read, pop, push, to] of tuples) {
    out.push({ id: nextTransitionId(out), from, read, pop, push, to });
  }
  return out;
}

describe('parseDraft', () => {
  it('reads accept states from the * marker and strips it', () => {
    const definition = parseDraft(draft, [], 'test');
    assert.deepEqual(definition.states, ['q0', 'q1', 'q2']);
    assert.deepEqual(definition.acceptStates, ['q2']);
    assert.equal(definition.startState, 'q0');
  });

  it('treats the first state as the start state', () => {
    const definition = parseDraft({ ...draft, states: 'qStart, qX*' }, [], 'test');
    assert.equal(definition.startState, 'qStart');
  });

  it('tolerates loose spacing and trailing commas', () => {
    const definition = parseDraft(
      { ...draft, states: ' q0 ,q1,  q2* ,', inputAlphabet: 'a , b ,' },
      [],
      'test'
    );
    assert.deepEqual(definition.states, ['q0', 'q1', 'q2']);
    assert.deepEqual(definition.inputAlphabet, ['a', 'b']);
  });

  it('drops a blank bottom marker to null rather than an empty symbol', () => {
    const definition = parseDraft({ ...draft, initialStackSymbol: '  ' }, [], 'test');
    assert.equal(definition.initialStackSymbol, null);
  });

  it('round-trips through toDraft', () => {
    const definition = parseDraft(draft, [], 'test');
    const restored = parseDraft(toDraft(definition), [], 'test');
    assert.deepEqual(restored, definition);
  });
});

describe('a hand-built PDA simulates correctly', () => {
  // aⁿbⁿ typed in from scratch, using the editor's default 'ε' field values.
  const transitions = rows([
    ['q0', 'a', 'Z0', 'AZ0', 'q0'],
    ['q0', 'a', 'A', 'AA', 'q0'],
    ['q0', 'b', 'A', 'ε', 'q1'],
    ['q1', 'b', 'A', 'ε', 'q1'],
    ['q1', 'ε', 'Z0', 'Z0', 'q2'],
  ]);
  const definition = parseDraft(draft, transitions, 'hand-built aⁿbⁿ');

  it('validates without errors', () => {
    const errors = validateDefinition(definition).filter(i => i.severity === 'error');
    assert.deepEqual(errors, []);
  });

  it('gives unique transition ids', () => {
    const ids = new Set(transitions.map(t => t.id));
    assert.equal(ids.size, transitions.length);
  });

  it('accepts and rejects the right strings', () => {
    for (const input of ['ab', 'aabb', 'aaabbb']) {
      assert.equal(simulate(definition, input, 'dpda').verdict, 'accepted', input);
    }
    for (const input of ['a', 'b', 'aab', 'abb', 'ba']) {
      assert.equal(simulate(definition, input, 'dpda').verdict, 'rejected', input);
    }
  });

  it('behaves the same in NPDA mode for a deterministic machine', () => {
    for (const input of ['ab', 'aabb', 'aab', 'ba']) {
      assert.equal(
        simulate(definition, input, 'npda').verdict,
        simulate(definition, input, 'dpda').verdict,
        input
      );
    }
  });

  it('is reported deterministic', () => {
    assert.equal(analyseDeterminism(definition).isDeterministic, true);
  });
});

describe('a machine with no bottom marker', () => {
  // Empty-stack acceptance with no Z0, the other common textbook convention.
  const noMarker = parseDraft(
    {
      states: 'q0, q1*',
      inputAlphabet: 'a, b',
      stackAlphabet: 'A',
      initialStackSymbol: '',
      acceptance: 'empty-stack',
    },
    rows([
      ['q0', 'a', 'ε', 'A', 'q0'],
      ['q0', 'b', 'A', 'ε', 'q0'],
      ['q0', 'ε', 'ε', 'ε', 'q1'],
    ]),
    'no marker'
  );

  it('starts from a genuinely empty stack', () => {
    const trace = simulate(noMarker, '', 'npda');
    assert.deepEqual(trace.nodes[0].config.stack, []);
  });

  it('accepts only when the stack is fully emptied', () => {
    assert.equal(simulate(noMarker, 'ab', 'npda').verdict, 'accepted');
    assert.equal(simulate(noMarker, 'aabb', 'npda').verdict, 'accepted');
    assert.equal(simulate(noMarker, 'a', 'npda').verdict, 'rejected');
    assert.equal(simulate(noMarker, 'aab', 'npda').verdict, 'rejected');
  });
});

describe('partially built machines do not crash the simulator', () => {
  it('handles a definition with states but no transitions', () => {
    const definition = parseDraft(draft, [], 'empty');
    const trace = simulate(definition, 'ab', 'dpda');
    assert.equal(trace.verdict, 'rejected');
    assert.equal(trace.nodes.length, 1);
  });

  it('handles a transition pushing a symbol outside the stack alphabet', () => {
    const definition = parseDraft(
      { ...draft, stackAlphabet: 'Z0' },
      rows([['q0', 'a', 'Z0', 'QZ0', 'q2']]),
      'odd push'
    );
    const trace = simulate(definition, 'a', 'dpda');
    // 'Q' is not in the alphabet, so it is pushed as a single character.
    assert.deepEqual(trace.nodes[1].config.stack, ['Z0', 'Q']);
    assert.ok(
      validateDefinition(definition).some(i => i.severity === 'warning')
    );
  });

  it('handles an unknown target state without throwing', () => {
    const definition = parseDraft(draft, rows([['q0', 'a', 'Z0', 'A', 'qGhost']]), 'ghost');
    assert.doesNotThrow(() => simulate(definition, 'a', 'dpda'));
    assert.ok(
      validateDefinition(definition).some(
        i => i.severity === 'error' && i.message.includes('qGhost')
      )
    );
  });

  it('handles an empty state list', () => {
    const definition = parseDraft({ ...draft, states: '' }, [], 'nothing');
    assert.doesNotThrow(() => simulate(definition, '', 'dpda'));
  });
});

describe('half-filled definitions still give correct verdicts', () => {
  // Regression: with an empty stack alphabet the tokenizer used to split every
  // push per character, so 'AZ0' became ['A','Z','0'] and balanced parentheses
  // was silently REJECTED with no warning at all.
  const noStackAlphabet = parseDraft(
    {
      states: 'q0, q2*',
      inputAlphabet: '(, )',
      stackAlphabet: '',
      initialStackSymbol: 'Z0',
      acceptance: 'final-state',
    },
    rows([
      ['q0', '(', 'Z0', 'AZ0', 'q0'],
      ['q0', '(', 'A', 'AA', 'q0'],
      ['q0', ')', 'A', 'ε', 'q0'],
      ['q0', 'ε', 'Z0', 'ε', 'q2'],
    ]),
    'no stack alphabet'
  );

  it('infers stack symbols from pops and the bottom marker', () => {
    const trace = simulate(noStackAlphabet, '(())', 'dpda');
    assert.deepEqual(trace.nodes[1].config.stack, ['Z0', 'A']);
  });

  it('accepts and rejects correctly despite the blank field', () => {
    assert.equal(simulate(noStackAlphabet, '(())', 'dpda').verdict, 'accepted');
    assert.equal(simulate(noStackAlphabet, '()()', 'dpda').verdict, 'accepted');
    assert.equal(simulate(noStackAlphabet, '(()', 'dpda').verdict, 'rejected');
  });

  it('matches the fully declared machine exactly', () => {
    for (const input of ['', '()', '(())', '()()', '(()', ')(']) {
      assert.equal(
        simulate(noStackAlphabet, input, 'dpda').verdict,
        simulate(exampleByKey.balanced.definition, input, 'dpda').verdict,
        input || 'ε'
      );
    }
  });
});

describe('silent-failure cases are warned about', () => {
  it('warns when a push symbol is neither declared nor ever popped', () => {
    // 'Q' cannot be inferred, so it would be split per character.
    const definition = parseDraft(
      { ...draft, stackAlphabet: 'Z0' },
      rows([['q0', 'a', 'Z0', 'QQZ0', 'q2']]),
      'ambiguous push'
    );
    const warnings = validateDefinition(definition).filter(i => i.severity === 'warning');
    assert.ok(
      warnings.some(w => w.message.includes('stack alphabet')),
      'expected a warning about the undeclared push symbol'
    );
  });

  it('warns that a multi-character input symbol can never match', () => {
    const definition = parseDraft(
      { ...draft, inputAlphabet: 'ab, b' },
      rows([['q0', 'ab', 'Z0', 'Z0', 'q2']]),
      'multi-char input'
    );
    const warnings = validateDefinition(definition).filter(i => i.severity === 'warning');
    assert.ok(
      warnings.some(w => w.message.includes('more than one character')),
      'expected a warning about the multi-character input symbol'
    );
    // And it genuinely cannot match, which is why the warning matters.
    assert.equal(simulate(definition, 'ab', 'dpda').verdict, 'rejected');
  });

  it('stays quiet when the definition is fully declared', () => {
    for (const key of Object.keys(exampleByKey)) {
      const warnings = validateDefinition(exampleByKey[key].definition).filter(
        i =>
          i.severity === 'warning' &&
          (i.message.includes('stack alphabet') ||
            i.message.includes('more than one character'))
      );
      assert.deepEqual(warnings, [], `${key} produced a spurious warning`);
    }
  });
});

describe('save and load round-trip', () => {
  it('preserves a custom machine exactly', () => {
    const definition = parseDraft(draft, rows([['q0', 'a', 'Z0', 'AZ0', 'q1']]), 'round trip');
    const json = serialiseDefinition(definition, 'aab');
    const loaded = parseDefinitionFile(json);
    assert.deepEqual(loaded.definition, definition);
    assert.equal(loaded.testString, 'aab');
  });

  it('reads a legacy file with no ids, marker or acceptance mode', () => {
    const legacy = JSON.stringify({
      states: ['q0', 'q1', 'q2*'],
      inputAlphabet: ['a', 'b'],
      stackAlphabet: ['Z0', 'A'],
      startState: 'q0',
      acceptStates: ['q2'],
      transitions: [{ from: 'q0', read: 'a', pop: 'Z0', push: 'AZ0', to: 'q0' }],
      testString: 'aabb',
    });
    const { definition } = parseDefinitionFile(legacy);
    assert.equal(definition.transitions[0].id, 't0');
    assert.equal(definition.initialStackSymbol, 'Z0');
    assert.equal(definition.acceptance, 'final-state');
    assert.deepEqual(definition.states, ['q0', 'q1', 'q2']);
  });

  it('rejects a file with no transitions array', () => {
    assert.throws(() => parseDefinitionFile(JSON.stringify({ states: ['q0'] })));
  });
});

describe('every built-in example round-trips through the editor', () => {
  it('survives toDraft then parseDraft unchanged', () => {
    for (const key of Object.keys(exampleByKey)) {
      const original = exampleByKey[key].definition;
      const restored = parseDraft(
        toDraft(original),
        original.transitions,
        original.name
      );
      assert.deepEqual(restored.states, original.states, key);
      assert.deepEqual(restored.acceptStates, original.acceptStates, key);
      assert.equal(restored.startState, original.startState, key);
      assert.equal(restored.initialStackSymbol, original.initialStackSymbol, key);
    }
  });
});
