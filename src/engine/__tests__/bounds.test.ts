import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PDADefinition } from '../../types/pda';
import { DEFAULT_LIMITS } from '../../types/pda';
import { buildTransitions } from '../examples';
import { simulate } from '../simulate';

/** A PDA whose only move is an epsilon self-loop that never changes anything. */
const epsilonSpin: PDADefinition = {
  name: 'epsilon spin',
  states: ['q0', 'q1'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z0'],
  startState: 'q0',
  acceptStates: ['q1'],
  initialStackSymbol: 'Z0',
  acceptance: 'final-state',
  transitions: buildTransitions([['q0', 'ε', 'ε', 'ε', 'q0']], 'spin'),
};

/** An epsilon loop that grows the stack forever, so no configuration repeats. */
const stackBomb: PDADefinition = {
  name: 'stack bomb',
  states: ['q0', 'q1'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z0', 'A'],
  startState: 'q0',
  acceptStates: ['q1'],
  initialStackSymbol: 'Z0',
  acceptance: 'final-state',
  transitions: buildTransitions([['q0', 'ε', 'ε', 'A', 'q0']], 'bomb'),
};

/** Epsilon moves that fan out, doubling the frontier every step. */
const fanOut: PDADefinition = {
  name: 'fan out',
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z0', 'A', 'B'],
  startState: 'q0',
  acceptStates: ['q2'],
  initialStackSymbol: 'Z0',
  acceptance: 'final-state',
  transitions: buildTransitions([
    ['q0', 'ε', 'ε', 'A', 'q0'],
    ['q0', 'ε', 'ε', 'B', 'q0'],
  ], 'fan'),
};

describe('epsilon cycles terminate', () => {
  it('halts on a self-looping epsilon move instead of hanging', () => {
    const trace = simulate(epsilonSpin, 'a', 'dpda');
    assert.equal(trace.verdict, 'rejected');
    // The repeated configuration is caught rather than iterated to the step cap.
    assert.ok(trace.steps.length < DEFAULT_LIMITS.maxSteps);
    assert.ok(
      trace.nodes.some(n => n.status === 'pruned-epsilon-cycle'),
      'expected an epsilon-cycle prune'
    );
  });

  it('halts in NPDA mode too', () => {
    const trace = simulate(epsilonSpin, 'a', 'npda');
    assert.equal(trace.verdict, 'rejected');
    assert.ok(trace.steps.length < DEFAULT_LIMITS.maxSteps);
  });
});

describe('unbounded stack growth is bounded', () => {
  it('stops a growing epsilon loop and reports it did not decide', () => {
    const trace = simulate(stackBomb, 'a', 'dpda');
    assert.equal(trace.verdict, 'incomplete');
    assert.ok(
      trace.nodes.every(n => n.config.stack.length <= DEFAULT_LIMITS.maxStackDepth + 1),
      'stack grew past the configured bound'
    );
  });

  it('respects a tightened stack bound', () => {
    const trace = simulate(stackBomb, 'a', 'dpda', {
      ...DEFAULT_LIMITS,
      maxStackDepth: 5,
    });
    assert.ok(
      trace.nodes.some(n => n.status === 'pruned-stack-depth'),
      'expected a stack-depth prune'
    );
  });
});

describe('branch explosion is bounded', () => {
  it('stops rather than exhausting memory', () => {
    const trace = simulate(fanOut, 'a', 'npda', {
      ...DEFAULT_LIMITS,
      maxNodes: 500,
      maxFrontier: 32,
    });
    assert.equal(trace.verdict, 'incomplete');
    assert.ok(trace.nodes.length <= 501, `node count ${trace.nodes.length} exceeded the cap`);
    assert.ok(
      trace.haltReason === 'max-nodes' || trace.haltReason === 'max-frontier',
      `unexpected halt reason ${trace.haltReason}`
    );
  });

  it('honours the step cap', () => {
    const trace = simulate(stackBomb, 'a', 'dpda', { ...DEFAULT_LIMITS, maxSteps: 7 });
    assert.equal(trace.haltReason, 'max-steps');
    assert.equal(trace.steps.length - 1, 7);
  });
});
