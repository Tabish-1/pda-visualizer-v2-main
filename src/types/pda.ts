// Shared domain types for the PDA visualiser.
//
// Conventions used throughout the engine:
//  - Epsilon is written 'ε'. The empty string '' is accepted as an alias everywhere.
//  - A stack is an array whose index 0 is the BOTTOM and whose last element is the TOP.
//  - `push` is read left to right, and its leftmost symbol ends up on top of the stack,
//    matching the usual textbook notation δ(q, a, X) → (p, YZ).

export const EPSILON = 'ε';

/** Which flavour of machine the simulator should run as. */
export type ExecutionMode = 'dpda' | 'npda';

/** When a configuration counts as accepting. */
export type AcceptanceMode =
  | 'final-state'
  | 'empty-stack'
  | 'final-state-and-empty-stack';

export interface Transition {
  id: string;
  from: string;
  /** Input symbol to consume, or epsilon to move without consuming. */
  read: string;
  /** Stack symbol that must be on top and is removed, or epsilon to leave the stack alone. */
  pop: string;
  /** Symbols to push; leftmost ends up on top. Epsilon pushes nothing. */
  push: string;
  to: string;
}

export interface PDADefinition {
  name: string;
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  transitions: Transition[];
  startState: string;
  acceptStates: string[];
  /** Placed on the stack before the run starts. null begins with an empty stack. */
  initialStackSymbol: string | null;
  acceptance: AcceptanceMode;
}

/** A single instantaneous description of the machine. */
export interface Configuration {
  state: string;
  stack: readonly string[];
  inputPosition: number;
}

/** Why a branch stopped being extended. */
export type BranchStatus =
  | 'active'
  | 'accepted'
  | 'dead-end'
  | 'pruned-duplicate'
  | 'pruned-epsilon-cycle'
  | 'pruned-stack-depth';

/**
 * One node of the execution tree. In DPDA mode the tree degenerates to a list.
 * Nodes are stored flat in `SimulationTrace.nodes` and referenced by index so
 * that the whole trace stays cheap to clone into React state.
 */
export interface BranchNode {
  index: number;
  parent: number | null;
  /** Depth in the execution tree; equals the number of transitions taken. */
  depth: number;
  config: Configuration;
  /** The transition that produced this node; null for the root. */
  via: Transition | null;
  /** The concrete input symbol consumed to get here, or null for an epsilon move. */
  consumed: string | null;
  children: number[];
  status: BranchStatus;
}

/** One playback frame: the set of branches alive after `step` transitions. */
export interface TraceStep {
  step: number;
  /** Indices into `SimulationTrace.nodes`. */
  frontier: number[];
  /** Highest input position reached by any branch in this frontier. */
  maxInputPosition: number;
}

export type SimulationVerdict = 'accepted' | 'rejected' | 'incomplete';

export type HaltReason =
  | 'accepted'
  | 'exhausted'
  | 'max-steps'
  | 'max-nodes'
  | 'max-frontier';

export interface SimulationTrace {
  mode: ExecutionMode;
  input: string;
  nodes: BranchNode[];
  steps: TraceStep[];
  verdict: SimulationVerdict;
  haltReason: HaltReason;
  /** Node index of the first accepting configuration found, if any. */
  acceptingNode: number | null;
  /** Root-to-accepting-node path, for highlighting the successful branch. */
  acceptingPath: number[];
  /** Set when DPDA mode hit a genuine choice point at runtime. */
  nondeterminismAt: { step: number; state: string; count: number } | null;
  message: string;
}

export interface SimulationLimits {
  maxSteps: number;
  maxNodes: number;
  maxFrontier: number;
  maxStackDepth: number;
  /** Consecutive epsilon moves allowed at one input position before pruning. */
  maxEpsilonRun: number;
}

export const DEFAULT_LIMITS: SimulationLimits = {
  maxSteps: 500,
  maxNodes: 20000,
  maxFrontier: 400,
  maxStackDepth: 400,
  maxEpsilonRun: 60,
};

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: IssueSeverity;
  message: string;
  /** Transition ids the issue relates to, when applicable. */
  transitionIds?: string[];
}

/**
 * A pair of transitions that overlap on the same (state, read, pop) trigger.
 *
 * `hard` means two input-consuming transitions compete, which is true
 * nondeterminism. `soft` means an epsilon move competes with a consuming move;
 * DPDA mode resolves those by giving epsilon lower priority.
 */
export interface DeterminismConflict {
  kind: 'hard' | 'soft';
  state: string;
  read: string;
  pop: string;
  transitionIds: string[];
  description: string;
}

export interface DeterminismReport {
  isDeterministic: boolean;
  conflicts: DeterminismConflict[];
}
