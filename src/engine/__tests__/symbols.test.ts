import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyStackEffect,
  configKey,
  isEpsilon,
  isStackEmpty,
  tokenizePush,
} from '../symbols';

describe('isEpsilon', () => {
  it('accepts both the empty string and the epsilon glyph', () => {
    assert.equal(isEpsilon(''), true);
    assert.equal(isEpsilon('ε'), true);
    assert.equal(isEpsilon(null), true);
    assert.equal(isEpsilon('a'), false);
  });
});

describe('tokenizePush', () => {
  const alphabet = ['Z0', 'A', 'B'];

  it('keeps multi-character stack symbols intact via longest match', () => {
    assert.deepEqual(tokenizePush('AZ0', alphabet), ['A', 'Z0']);
    assert.deepEqual(tokenizePush('Z0', alphabet), ['Z0']);
    assert.deepEqual(tokenizePush('AA', alphabet), ['A', 'A']);
  });

  it('treats epsilon as pushing nothing', () => {
    assert.deepEqual(tokenizePush('ε', alphabet), []);
    assert.deepEqual(tokenizePush('', alphabet), []);
  });

  it('falls back to single characters for symbols outside the alphabet', () => {
    assert.deepEqual(tokenizePush('XY', alphabet), ['X', 'Y']);
  });
});

describe('applyStackEffect', () => {
  const alphabet = ['Z0', 'A'];

  it('puts the leftmost pushed symbol on top', () => {
    // δ(q, a, Z0) → (q, AZ0) on stack [Z0] leaves Z0 at the bottom, A on top.
    assert.deepEqual(applyStackEffect(['Z0'], 'Z0', 'AZ0', alphabet), ['Z0', 'A']);
  });

  it('pops without pushing', () => {
    assert.deepEqual(applyStackEffect(['Z0', 'A'], 'A', 'ε', alphabet), ['Z0']);
  });

  it('leaves the stack alone on an epsilon pop and epsilon push', () => {
    assert.deepEqual(applyStackEffect(['Z0'], 'ε', 'ε', alphabet), ['Z0']);
  });

  it('rejects a pop that does not match the top', () => {
    assert.equal(applyStackEffect(['Z0'], 'A', 'ε', alphabet), null);
  });

  it('rejects any pop from an empty stack', () => {
    assert.equal(applyStackEffect([], 'Z0', 'ε', alphabet), null);
  });

  it('does not mutate the input stack', () => {
    const stack = ['Z0', 'A'];
    applyStackEffect(stack, 'A', 'AA', alphabet);
    assert.deepEqual(stack, ['Z0', 'A']);
  });
});

describe('isStackEmpty', () => {
  it('treats a lone bottom marker as empty when one is configured', () => {
    assert.equal(isStackEmpty(['Z0'], 'Z0'), true);
    assert.equal(isStackEmpty([], 'Z0'), true);
    assert.equal(isStackEmpty(['Z0', 'A'], 'Z0'), false);
  });

  it('requires a truly empty stack when there is no marker', () => {
    assert.equal(isStackEmpty(['Z0'], null), false);
    assert.equal(isStackEmpty([], null), true);
  });
});

describe('configKey', () => {
  it('distinguishes stack order', () => {
    assert.notEqual(configKey('q', ['A', 'B'], 0), configKey('q', ['B', 'A'], 0));
  });

  it('distinguishes input position', () => {
    assert.notEqual(configKey('q', ['A'], 0), configKey('q', ['A'], 1));
  });
});
