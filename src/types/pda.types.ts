
// the TypeScript interfaces for PDA.

export interface Transition {
  from: string;
  to: string;
  read: string;  // read from input
  pop: string;   // pop from stack
  push: string;  // push to stack
}

export interface PDAConfig {
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  transitions: Transition[];
  startState: string;
  acceptStates: string[];
}

export interface StepResult {
  success: boolean;
  currentState: string;
  stackContents: string[];
  inputPosition: number;
  message?: string;
  accepted?: boolean;
}

export interface SimulationStep {
  state: string;
  stack: string[];
  position: number;
  transition?: Transition;
}