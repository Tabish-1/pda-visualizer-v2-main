import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ExecutionMode } from '../../types/pda';
import { exampleByKey } from '../examples';
import { simulate } from '../simulate';

function verdict(key: string, input: string, mode?: ExecutionMode) {
  const example = exampleByKey[key];
  return simulate(example.definition, input, mode ?? example.mode).verdict;
}

describe('DPDA examples keep their established behaviour', () => {
  it('accepts balanced parenthesis strings', () => {
    for (const input of ['', '()', '(())', '()()', '((()))', '(()())']) {
      assert.equal(verdict('balanced', input), 'accepted', `expected ${input || 'ε'} accepted`);
    }
  });

  it('rejects unbalanced parenthesis strings', () => {
    for (const input of ['(', ')', '(()', '())', ')(']) {
      assert.equal(verdict('balanced', input), 'rejected', `expected ${input} rejected`);
    }
  });

  it('accepts exactly aⁿbⁿ for n ≥ 1', () => {
    assert.equal(verdict('anbn', 'ab'), 'accepted');
    assert.equal(verdict('anbn', 'aabb'), 'accepted');
    assert.equal(verdict('anbn', 'aaabbb'), 'accepted');
    for (const input of ['aab', 'abb', 'ba', 'aabbb', 'a', 'b']) {
      assert.equal(verdict('anbn', input), 'rejected', `expected ${input} rejected`);
    }
  });

  it('accepts wcwᴿ palindromes', () => {
    for (const input of ['c', 'aca', 'abcba', 'aacaa', 'bacab']) {
      assert.equal(verdict('palindrome', input), 'accepted', `expected ${input} accepted`);
    }
    for (const input of ['abcab', 'abc', 'ac', 'abba']) {
      assert.equal(verdict('palindrome', input), 'rejected', `expected ${input} rejected`);
    }
  });
});

describe('NPDA mode explores branches that DPDA mode cannot', () => {
  it('accepts even palindromes only when nondeterminism is available', () => {
    for (const input of ['', 'aa', 'abba', 'aabbaa', 'baab']) {
      assert.equal(verdict('evenPalindrome', input, 'npda'), 'accepted', `npda ${input || 'ε'}`);
    }
    for (const input of ['abab', 'ab', 'aab', 'a']) {
      assert.equal(verdict('evenPalindrome', input, 'npda'), 'rejected', `npda ${input}`);
    }
  });

  it('rejects abba in DPDA mode because the midpoint guess never fires', () => {
    assert.equal(verdict('evenPalindrome', 'abba', 'dpda'), 'rejected');
    assert.equal(verdict('evenPalindrome', 'abba', 'npda'), 'accepted');
  });

  it('decides aⁱbʲcᵏ with i=j or j=k', () => {
    // i=j cases, j=k cases, and 'aabc' where i=2,j=1,k=1 satisfies j=k.
    for (const input of ['aabbc', 'abbcc', 'aabbcc', 'abc', 'aabc', 'c', '']) {
      assert.equal(verdict('aibjck', input, 'npda'), 'accepted', `npda ${input || 'ε'}`);
    }
    // 'abbc': i=1,j=2,k=1 — neither i=j nor j=k holds.
    for (const input of ['abbc', 'aabbbcc', 'aabbbc']) {
      assert.equal(verdict('aibjck', input, 'npda'), 'rejected', `npda ${input}`);
    }
  });
});

describe('trace structure', () => {
  const example = exampleByKey.anbn;

  it('records one step per transition taken and ends on the accepting node', () => {
    const trace = simulate(example.definition, 'aabb', 'dpda');
    assert.equal(trace.verdict, 'accepted');
    assert.notEqual(trace.acceptingNode, null);

    // Each step's frontier sits at the matching depth.
    for (const step of trace.steps) {
      for (const index of step.frontier) {
        assert.equal(trace.nodes[index].depth, step.step);
      }
    }

    // The accepting path starts at the root and walks child links forward.
    assert.equal(trace.acceptingPath[0], 0);
    assert.equal(
      trace.acceptingPath[trace.acceptingPath.length - 1],
      trace.acceptingNode
    );
    for (let i = 1; i < trace.acceptingPath.length; i += 1) {
      const node = trace.nodes[trace.acceptingPath[i]];
      assert.equal(node.parent, trace.acceptingPath[i - 1]);
    }
  });

  it('keeps the DPDA frontier at a single branch throughout', () => {
    const trace = simulate(exampleByKey.palindrome.definition, 'abcba', 'dpda');
    for (const step of trace.steps) {
      assert.equal(step.frontier.length, 1, `step ${step.step} branched`);
    }
  });

  it('branches the NPDA frontier past one node', () => {
    const trace = simulate(exampleByKey.evenPalindrome.definition, 'abba', 'npda');
    assert.ok(
      trace.steps.some(step => step.frontier.length > 1),
      'expected at least one branching frontier'
    );
  });

  it('marks the start configuration accepting when it already accepts', () => {
    const trace = simulate(exampleByKey.balanced.definition, '', 'dpda');
    assert.equal(trace.verdict, 'accepted');
    assert.ok(trace.acceptingPath.length >= 1);
  });
});
