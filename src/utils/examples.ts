
// Pre-defined example PDAs for testing

import { PDAConfig } from '../types/pda.types';

export const examplePDAs: Record<string, PDAConfig> = {
  balancedParentheses: {
    states: ['q0', 'qAccept'],
    inputAlphabet: ['(', ')'],
    stackAlphabet: ['(', 'Z'],
    transitions: [
      { from: 'q0', to: 'q0', read: '(', pop: '', push: '(' },
      { from: 'q0', to: 'q0', read: ')', pop: '(', push: '' },
      { from: 'q0', to: 'qAccept', read: '', pop: '', push: '' }
    ],
    startState: 'q0',
    acceptStates: ['qAccept']
  },
  
  anbn: {
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['a', 'Z'],
    transitions: [
      { from: 'q0', to: 'q0', read: 'a', pop: '', push: 'a' },
      { from: 'q0', to: 'q1', read: 'b', pop: 'a', push: '' },
      { from: 'q1', to: 'q1', read: 'b', pop: 'a', push: '' },
      { from: 'q1', to: 'q2', read: '', pop: '', push: '' }
    ],
    startState: 'q0',
    acceptStates: ['q2']
  },

  palindrome: {
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b', 'c'],
    stackAlphabet: ['a', 'b', 'Z'],
    transitions: [
      { from: 'q0', to: 'q0', read: 'a', pop: '', push: 'a' },
      { from: 'q0', to: 'q0', read: 'b', pop: '', push: 'b' },
      { from: 'q0', to: 'q1', read: 'c', pop: '', push: '' },
      { from: 'q1', to: 'q1', read: 'a', pop: 'a', push: '' },
      { from: 'q1', to: 'q1', read: 'b', pop: 'b', push: '' },
      { from: 'q1', to: 'q2', read: '', pop: '', push: '' }
    ],
    startState: 'q0',
    acceptStates: ['q2']
  }
};