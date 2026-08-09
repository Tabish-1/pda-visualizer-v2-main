// The unified PDA simulator.
//
// One walker serves both execution modes. It builds the whole execution tree up
// front and returns an immutable `SimulationTrace`; playback in the UI is then
// just an index into `trace.steps`, which is what makes step-backward, pause and
// speed changes trivial and allocation-free.
//
// DPDA and NPDA differ in exactly one place — `selectMoves` — where DPDA keeps a
// single successor and NPDA keeps all of them.

import {
  DEFAULT_LIMITS,
  type BranchNode,
  type Configuration,
  type ExecutionMode,
  type HaltReason,
  type PDADefinition,
  type SimulationLimits,
  type SimulationTrace,
  type TraceStep,
  type Transition,
} from '../types/pda';
import {
  applyStackEffect,
  configKey,
  effectiveStackAlphabet,
  initialStack,
  isEpsilon,
  isStackEmpty,
} from './symbols';

/** A transition that applies, paired with the configuration it produces. */
interface Move {
  transition: Transition;
  next: Configuration;
  consumed: string | null;
}

/** Whether a configuration satisfies the definition's acceptance rule. */
export function isAccepting(
  definition: PDADefinition,
  config: Configuration,
  input: string
): boolean {
  if (config.inputPosition < input.length) return false;

  const inFinalState = definition.acceptStates.includes(config.state);
  const stackEmpty = isStackEmpty(config.stack, definition.initialStackSymbol);

  switch (definition.acceptance) {
    case 'final-state':
      return inFinalState;
    case 'empty-stack':
      return stackEmpty;
    case 'final-state-and-empty-stack':
      return inFinalState && stackEmpty;
  }
}

/**
 * Every transition that applies to `config`, in definition order.
 *
 * A consuming transition needs its symbol under the read head; an epsilon
 * transition applies regardless of remaining input. A pop that cannot be
 * satisfied removes the transition from consideration.
 */
export function applicableMoves(
  definition: PDADefinition,
  config: Configuration,
  input: string,
  /** Pass the precomputed alphabet to avoid rebuilding it per configuration. */
  stackAlphabet: readonly string[] = effectiveStackAlphabet(definition)
): Move[] {
  const moves: Move[] = [];
  const symbol =
    config.inputPosition < input.length ? input[config.inputPosition] : null;

  for (const transition of definition.transitions) {
    if (transition.from !== config.state) continue;

    const epsilonRead = isEpsilon(transition.read);
    if (!epsilonRead && (symbol === null || transition.read !== symbol)) continue;

    const stack = applyStackEffect(
      config.stack,
      transition.pop,
      transition.push,
      stackAlphabet
    );
    if (stack === null) continue;

    moves.push({
      transition,
      consumed: epsilonRead ? null : symbol,
      next: {
        state: transition.to,
        stack,
        inputPosition: config.inputPosition + (epsilonRead ? 0 : 1),
      },
    });
  }

  return moves;
}

/** Walks parent links from a node back to the root, root first. */
export function pathToRoot(nodes: readonly BranchNode[], index: number): number[] {
  const path: number[] = [];
  let cursor: number | null = index;
  while (cursor !== null) {
    path.push(cursor);
    cursor = nodes[cursor].parent;
  }
  return path.reverse();
}

/** Builds the verdict and the human-readable summary shown in the banner. */
function finalise(
  input: string,
  mode: ExecutionMode,
  nodes: BranchNode[],
  steps: TraceStep[],
  acceptingNode: number | null,
  haltReason: HaltReason,
  nondeterminismAt: SimulationTrace['nondeterminismAt'],
  truncated: boolean
): SimulationTrace {
  const acceptingPath = acceptingNode === null ? [] : pathToRoot(nodes, acceptingNode);

  let verdict: SimulationTrace['verdict'];
  let message: string;

  if (acceptingNode !== null) {
    verdict = 'accepted';
    const branches = mode === 'npda' ? ' on one of the explored branches' : '';
    message = `Accepted — reached ${nodes[acceptingNode].config.state} with all input consumed${branches}.`;
  } else if (haltReason === 'exhausted' && truncated) {
    // Ran out of frontier, but only because a bound abandoned live branches.
    // Claiming rejection here would assert something never actually checked.
    verdict = 'incomplete';
    message =
      'Stopped — a branch grew past the stack or ε-cycle bound, so the input ' +
      'could not be decided. The machine may loop or push without limit here.';
  } else if (haltReason === 'exhausted') {
    verdict = 'rejected';
    const last = steps[steps.length - 1];
    const stalled = last.frontier
      .map(i => nodes[i])
      .filter(n => n.status === 'dead-end');
    if (mode === 'dpda' && stalled.length === 1) {
      const node = stalled[0];
      const remaining = input.slice(node.config.inputPosition);
      message = remaining
        ? `Rejected — no transition from ${node.config.state} on "${remaining[0]}" with ${
            node.config.stack[node.config.stack.length - 1] ?? 'an empty stack'
          } on top.`
        : `Rejected — input consumed but ${node.config.state} is not an accepting configuration.`;
    } else {
      message = 'Rejected — every branch reached a dead end without accepting.';
    }
  } else {
    verdict = 'incomplete';
    message =
      haltReason === 'max-steps'
        ? `Stopped after ${steps.length - 1} steps without deciding. The machine may loop on this input.`
        : haltReason === 'max-frontier'
        ? 'Stopped — too many simultaneous branches to keep exploring.'
        : 'Stopped — the execution tree grew past the exploration limit.';
  }

  if (mode === 'dpda' && nondeterminismAt !== null) {
    message += ` Note: ${nondeterminismAt.count} moves competed at ${nondeterminismAt.state} on step ${nondeterminismAt.step}; DPDA mode took the first. Switch to NPDA to explore all of them.`;
  }

  return {
    mode,
    input,
    nodes,
    steps,
    verdict,
    haltReason,
    acceptingNode,
    acceptingPath,
    nondeterminismAt,
    message,
  };
}

/** Result of narrowing the applicable moves down to what the mode will follow. */
interface Selection {
  moves: Move[];
  /** Number of genuinely competing moves, used to report DPDA violations. */
  competing: number;
}

/**
 * The one place the two modes diverge.
 *
 * NPDA follows every applicable move, producing a branching tree.
 *
 * DPDA follows exactly one. Consuming moves take priority over epsilon moves —
 * the standard convention that lets a PDA use an epsilon move as its
 * end-of-input accept step without being nondeterministic. If more than one move
 * survives that filter the machine is not deterministic, and the count is
 * reported so the UI can say so instead of silently picking the first.
 */
export function selectMoves(mode: ExecutionMode, moves: Move[]): Selection {
  if (mode === 'npda') {
    return { moves, competing: moves.length };
  }

  const consuming = moves.filter(m => m.consumed !== null);
  const chosen = consuming.length > 0 ? consuming : moves;

  return {
    moves: chosen.length > 0 ? [chosen[0]] : [],
    competing: chosen.length,
  };
}

/**
 * Walks the machine level-synchronously: every node in a frontier takes exactly
 * one transition to reach the next frontier, so `steps[k]` is "after k
 * transitions" for every branch and playback stays aligned across branches.
 *
 * The walk stops at the first accepting configuration, so the trace ends on the
 * successful branch rather than continuing to explore.
 */
export function simulate(
  definition: PDADefinition,
  input: string,
  mode: ExecutionMode,
  limits: SimulationLimits = DEFAULT_LIMITS
): SimulationTrace {
  const nodes: BranchNode[] = [];
  const steps: TraceStep[] = [];
  // Built once here rather than per configuration; the walk can visit thousands.
  const stackAlphabet = effectiveStackAlphabet(definition);

  /** Consecutive epsilon moves behind each node, to bound epsilon cycles. */
  const epsilonRun: number[] = [];
  /** Configurations already explored; a repeat can only be a loop. */
  const visited = new Set<string>();

  /**
   * Set when a bound abandoned configurations that were never explored.
   *
   * Dropping a repeated configuration is sound — it provably has the same future
   * as the copy already being explored — so it does not set this. The depth and
   * epsilon-run bounds are different: they give up on real unexplored branches,
   * which means the run can no longer claim the string is rejected, only that it
   * did not finish deciding.
   */
  let truncated = false;

  const addNode = (
    parent: number | null,
    depth: number,
    config: Configuration,
    via: Transition | null,
    consumed: string | null,
    run: number
  ): BranchNode => {
    const node: BranchNode = {
      index: nodes.length,
      parent,
      depth,
      config,
      via,
      consumed,
      children: [],
      status: 'active',
    };
    nodes.push(node);
    epsilonRun.push(run);
    if (parent !== null) nodes[parent].children.push(node.index);
    return node;
  };

  const root = addNode(
    null,
    0,
    { state: definition.startState, stack: initialStack(definition), inputPosition: 0 },
    null,
    null,
    0
  );
  visited.add(configKey(root.config.state, root.config.stack, root.config.inputPosition));

  let acceptingNode: number | null = null;
  let haltReason: HaltReason = 'exhausted';
  let nondeterminismAt: SimulationTrace['nondeterminismAt'] = null;

  if (isAccepting(definition, root.config, input)) {
    root.status = 'accepted';
    acceptingNode = root.index;
    haltReason = 'accepted';
  }

  steps.push({ step: 0, frontier: [root.index], maxInputPosition: root.config.inputPosition });

  let frontier = acceptingNode === null ? [root.index] : [];

  while (frontier.length > 0) {
    if (steps.length - 1 >= limits.maxSteps) {
      haltReason = 'max-steps';
      break;
    }

    const nextFrontier: number[] = [];
    /** Every node born this level, pruned ones included, so the UI can show them. */
    const created: number[] = [];
    let capHit: HaltReason | null = null;

    for (const index of frontier) {
      const node = nodes[index];
      const all = applicableMoves(definition, node.config, input, stackAlphabet);
      const { moves, competing } = selectMoves(mode, all);

      if (mode === 'dpda' && competing > 1 && nondeterminismAt === null) {
        nondeterminismAt = { step: node.depth, state: node.config.state, count: competing };
      }

      if (moves.length === 0) {
        if (node.status === 'active') node.status = 'dead-end';
        continue;
      }

      for (const move of moves) {
        if (nodes.length >= limits.maxNodes) {
          capHit = 'max-nodes';
          break;
        }

        const run = move.consumed === null ? epsilonRun[index] + 1 : 0;
        const child = addNode(
          index,
          node.depth + 1,
          move.next,
          move.transition,
          move.consumed,
          run
        );
        created.push(child.index);

        if (move.next.stack.length > limits.maxStackDepth) {
          child.status = 'pruned-stack-depth';
          truncated = true;
          continue;
        }
        if (run > limits.maxEpsilonRun) {
          child.status = 'pruned-epsilon-cycle';
          truncated = true;
          continue;
        }

        const key = configKey(
          move.next.state,
          move.next.stack,
          move.next.inputPosition
        );
        if (visited.has(key)) {
          child.status =
            move.consumed === null ? 'pruned-epsilon-cycle' : 'pruned-duplicate';
          continue;
        }
        visited.add(key);

        if (isAccepting(definition, move.next, input)) {
          child.status = 'accepted';
          acceptingNode = child.index;
          break;
        }

        nextFrontier.push(child.index);
      }

      if (acceptingNode !== null || capHit !== null) break;
    }

    if (created.length > 0) {
      let maxInputPosition = 0;
      for (const index of created) {
        const position = nodes[index].config.inputPosition;
        if (position > maxInputPosition) maxInputPosition = position;
      }
      steps.push({ step: steps.length, frontier: created, maxInputPosition });
    }

    if (acceptingNode !== null) {
      haltReason = 'accepted';
      break;
    }
    if (capHit !== null) {
      haltReason = capHit;
      break;
    }
    if (nextFrontier.length > limits.maxFrontier) {
      haltReason = 'max-frontier';
      break;
    }

    frontier = nextFrontier;
  }

  return finalise(
    input,
    mode,
    nodes,
    steps,
    acceptingNode,
    haltReason,
    nondeterminismAt,
    truncated
  );
}
