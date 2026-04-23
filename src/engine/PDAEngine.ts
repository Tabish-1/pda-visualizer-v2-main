

// main PDA simulation engine

import { Stack } from './Stack';
import { PDAConfig, StepResult, SimulationStep, Transition } from '../types/pda.types';

export class PDAEngine {
  private config: PDAConfig;
  private currentState: string;
  private stack: Stack;
  private inputPosition: number;
  private history: SimulationStep[];

  constructor(config: PDAConfig) {
    this.config = config;
    this.currentState = config.startState;
    this.stack = new Stack();
    this.inputPosition = 0;
    this.history = [];
    
    // Save initial state
    this.history.push({
      state: this.currentState,
      stack: this.stack.getContents(),
      position: this.inputPosition
    });
  }

  getCurrentState(): string {
    return this.currentState;
  }

  getStack(): string[] {
    return this.stack.getContents();
  }

  getInputPosition(): number {
    return this.inputPosition;
  }

  getHistory(): SimulationStep[] {
    return this.history;
  }

  // Find all valid transitions from current configuration
  findTransitions(state: string, inputSymbol: string, stackTop: string): Transition[] {
    return this.config.transitions.filter(t => {
      const matchesState = t.from === state;
      const matchesInput = t.read === inputSymbol || t.read === 'ε' || t.read === '';
      const matchesStack = t.pop === stackTop || t.pop === 'ε' || t.pop === '';
      return matchesState && matchesInput && matchesStack;
    });
  }

  // Execute one step of the PDA
  step(input: string): StepResult {
    const currentSymbol = this.inputPosition < input.length 
      ? input[this.inputPosition] 
      : 'ε';
    const stackTop = this.stack.peek() || 'ε';

    // Find possible transitions
    const possibleTransitions = this.findTransitions(
      this.currentState, 
      currentSymbol, 
      stackTop
    );

    if (possibleTransitions.length === 0) {
      return {
        success: false,
        currentState: this.currentState,
        stackContents: this.stack.getContents(),
        inputPosition: this.inputPosition,
        message: "No valid transition found"
      };
    }

    // Take the first valid transition (for DPDA)
    const transition = possibleTransitions[0];
    this.executeTransition(transition);

    // Check if we've accepted
    const isAtEnd = this.inputPosition >= input.length;
    const isInAcceptState = this.config.acceptStates.includes(this.currentState);
    const stackIsEmpty = this.stack.isEmpty();

    return {
      success: true,
      currentState: this.currentState,
      stackContents: this.stack.getContents(),
      inputPosition: this.inputPosition,
      accepted: isAtEnd && isInAcceptState && stackIsEmpty
    };
  }

  // Execute a single transition
  private executeTransition(transition: Transition): void {
    // Pop from stack if needed
    if (transition.pop !== 'ε' && transition.pop !== '') {
      this.stack.pop();
    }

    // Push to stack if needed (in reverse for multi-char pushes)
    if (transition.push !== 'ε' && transition.push !== '') {
      for (let i = transition.push.length - 1; i >= 0; i--) {
        this.stack.push(transition.push[i]);
      }
    }

    // Move to next state
    this.currentState = transition.to;

    // Advance input if we read a symbol
    if (transition.read !== 'ε' && transition.read !== '') {
      this.inputPosition++;
    }

    // Save step to history
    this.history.push({
      state: this.currentState,
      stack: this.stack.getContents(),
      position: this.inputPosition,
      transition
    });
  }

  // Reset to initial state
  reset(): void {
    this.currentState = this.config.startState;
    this.stack.clear();
    this.inputPosition = 0;
    this.history = [{
      state: this.currentState,
      stack: this.stack.getContents(),
      position: this.inputPosition
    }];
  }
}