import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PDADefinition } from '../../types/pda';
import {
  analyseDeterminism,
  formatTransitionLabel,
  reachableStates,
  validateDefinition,
  validateInput,
} from '../analysis';
import { buildTransitions, exampleByKey, examples } from '../examples';

function withTransitions(
  tuples: Parameters<typeof buildTransitions>[0],
  overrides: Partial<PDADefinition> = {}
): PDADefinition {
  return {
    name: 'test',
    states: ['q0', 'q1'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['Z0', 'A'],
    startState: 'q0',
    acceptStates: ['q1'],
    initialStackSymbol: 'Z0',
    acceptance: 'final-state',
    transitions: buildTransitions(tuples),
    ...overrides,
  };
}

describe('determinism checking', () => {
  it('passes the DPDA examples', () => {
    for (const key of ['balanced', 'anbn', 'palindrome']) {
      const report = analyseDeterminism(exampleByKey[key].definition);
      assert.equal(report.isDeterministic, true, `${key} was flagged nondeterministic`);
      assert.ok(
        report.conflicts.every(c => c.kind === 'soft'),
        `${key} reported a hard conflict`
      );
    }
  });

  it('flags two consuming moves on the same trigger as hard', () => {
    const report = analyseDeterminism(
      withTransitions([
        ['q0', 'a', 'Z0', 'A', 'q0'],
        ['q0', 'a', 'Z0', 'ε', 'q1'],
      ])
    );
    assert.equal(report.isDeterministic, false);
    assert.equal(report.conflicts.filter(c => c.kind === 'hard').length, 1);
  });

  it('flags two epsilon moves on the same stack top as hard', () => {
    // Nothing distinguishes these, so the epsilon-priority rule cannot help.
    const report = analyseDeterminism(
      withTransitions([
        ['q0', 'ε', 'Z0', 'Z0', 'q0'],
        ['q0', 'ε', 'Z0', 'Z0', 'q1'],
      ])
    );
    assert.equal(report.isDeterministic, false);
    assert.equal(report.conflicts.filter(c => c.kind === 'hard').length, 1);
  });

  it('treats an epsilon move competing with a consuming move as soft', () => {
    const report = analyseDeterminism(
      withTransitions([
        ['q0', 'a', 'Z0', 'A', 'q0'],
        ['q0', 'ε', 'Z0', 'Z0', 'q1'],
      ])
    );
    assert.equal(report.isDeterministic, true);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0].kind, 'soft');
  });

  it('treats an epsilon pop as overlapping every concrete pop', () => {
    const report = analyseDeterminism(
      withTransitions([
        ['q0', 'a', 'Z0', 'A', 'q0'],
        ['q0', 'a', 'ε', 'ε', 'q1'],
      ])
    );
    assert.equal(report.isDeterministic, false);
  });

  it('sees no conflict between different read symbols or different pops', () => {
    const report = analyseDeterminism(
      withTransitions([
        ['q0', 'a', 'Z0', 'A', 'q0'],
        ['q0', 'b', 'Z0', 'A', 'q0'],
        ['q0', 'a', 'A', 'AA', 'q0'],
      ])
    );
    assert.equal(report.conflicts.length, 0);
  });

  it('reports the NPDA union example as genuinely nondeterministic', () => {
    const report = analyseDeterminism(exampleByKey.aibjck.definition);
    assert.equal(report.isDeterministic, false);
    assert.ok(report.conflicts.some(c => c.kind === 'hard'));
  });
});

describe('validation', () => {
  it('accepts every built-in example without errors', () => {
    for (const example of examples) {
      const errors = validateDefinition(example.definition).filter(
        i => i.severity === 'error'
      );
      assert.deepEqual(errors, [], `${example.key} produced errors`);
    }
  });

  it('reports transitions referencing unknown states', () => {
    const issues = validateDefinition(withTransitions([['q0', 'a', 'Z0', 'A', 'qX']]));
    assert.ok(issues.some(i => i.severity === 'error' && i.message.includes('qX')));
  });

  it('reports a start state outside the state set', () => {
    const issues = validateDefinition(
      withTransitions([['q0', 'a', 'Z0', 'A', 'q1']], { startState: 'qZ' })
    );
    assert.ok(issues.some(i => i.severity === 'error' && i.message.includes('qZ')));
  });

  it('warns about unreachable states', () => {
    const issues = validateDefinition(
      withTransitions([['q0', 'a', 'Z0', 'A', 'q0']], { states: ['q0', 'q1', 'q9'] })
    );
    assert.ok(issues.some(i => i.severity === 'warning' && i.message.includes('q9')));
  });

  it('warns about input symbols outside the alphabet', () => {
    const issues = validateInput(exampleByKey.anbn.definition, 'aabbz');
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('"z"'));
  });
});

describe('reachability and labels', () => {
  it('finds only states reachable from the start', () => {
    const reachable = reachableStates(
      withTransitions([['q0', 'a', 'Z0', 'A', 'q1']], { states: ['q0', 'q1', 'q2'] })
    );
    assert.deepEqual([...reachable].sort(), ['q0', 'q1']);
  });

  it('formats an edge label as "read, pop → push"', () => {
    const [t] = buildTransitions([['q0', 'a', 'Z0', 'AZ0', 'q0']]);
    assert.equal(formatTransitionLabel(t), 'a, Z0 → AZ0');
    const [e] = buildTransitions([['q0', 'ε', 'ε', '', 'q0']]);
    assert.equal(formatTransitionLabel(e), 'ε, ε → ε');
  });
});
