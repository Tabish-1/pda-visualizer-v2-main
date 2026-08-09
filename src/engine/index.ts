// Public surface of the simulation engine. UI code imports from here so the
// internal module split can change without touching components.

export {
  analyseDeterminism,
  formatTransition,
  formatTransitionLabel,
  formatTrigger,
  reachableStates,
  validateDefinition,
  validateInput,
} from './analysis';

export {
  buildTransitions,
  cloneDefinition,
  exampleByKey,
  examples,
  type Example,
} from './examples';

export {
  applicableMoves,
  isAccepting,
  pathToRoot,
  selectMoves,
  simulate,
} from './simulate';

export {
  applyStackEffect,
  configKey,
  displaySymbol,
  initialStack,
  isEpsilon,
  isStackEmpty,
  stripAcceptMarker,
  tokenizePush,
} from './symbols';
