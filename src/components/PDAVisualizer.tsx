// src/components/PDAVisualizer.tsx
// Main component that brings everything together

'use client';

import React, { useState } from 'react';
import { Play, SkipForward, RotateCcw, Save } from 'lucide-react';
import { PDAEngine } from '../engine/PDAEngine';
import { PDAConfig, Transition } from '../types/pda.types';
import { examplePDAs } from '../utils/examples';
import { StateEditor } from './StateEditor';
import { TransitionEditor } from './TransitionEditor';
import { StackVisualizer } from './StackVisualizer';
import { InputTape } from './InputTape';
import { StateDiagram } from './StateDiagram';

export const PDAVisualizer: React.FC = () => {
  // State management
  const [states, setStates] = useState<string[]>(['q0', 'q1']);
  const [startState, setStartState] = useState<string>('q0');
  const [acceptStates, setAcceptStates] = useState<string[]>(['q1']);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [input, setInput] = useState<string>('');
  const [engine, setEngine] = useState<PDAEngine | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationStatus, setSimulationStatus] = useState<string>('');

  // Initialize the PDA engine
  const createEngine = () => {
    if (states.length === 0 || !startState) {
      alert('Please define at least one state and set a start state');
      return;
    }

    const config: PDAConfig = {
      states,
      inputAlphabet: [],
      stackAlphabet: [],
      transitions,
      startState,
      acceptStates
    };

    const newEngine = new PDAEngine(config);
    setEngine(newEngine);
    setSimulationStatus('✅ PDA initialized. Ready to simulate!');
  };

  // Execute one step
  const stepForward = () => {
    if (!engine || !input) return;

    const result = engine.step(input);

    if (!result.success) {
      setSimulationStatus(`❌ Rejected: ${result.message}`);
      setIsRunning(false);
    } else if (result.accepted) {
      setSimulationStatus('✅ String Accepted! 🎉');
      setIsRunning(false);
    } else if (result.inputPosition >= input.length) {
      setSimulationStatus('❌ Rejected: Input consumed but not in accept state or stack not empty');
      setIsRunning(false);
    } else {
      setSimulationStatus(`▶️ Step ${result.inputPosition} of ${input.length}`);
    }
  };

  // Play simulation automatically
  const playSimulation = async () => {
    if (!engine || !input) return;

    setIsRunning(true);
    let running = true;
    
    while (engine.getInputPosition() < input.length && running) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const result = engine.step(input);
      
      if (!result.success) {
        setSimulationStatus(`❌ Rejected: ${result.message}`);
        running = false;
      } else if (result.accepted) {
        setSimulationStatus('✅ String Accepted! 🎉');
        running = false;
      } else if (result.inputPosition >= input.length) {
        setSimulationStatus('❌ Rejected: Input consumed but not in accept state or stack not empty');
        running = false;
      }
    }
    
    setIsRunning(false);
  };

  // Reset simulation
  const resetSimulation = () => {
    if (engine) {
      engine.reset();
      setSimulationStatus('🔄 Reset to initial state');
      setIsRunning(false);
    }
  };

  // Load example PDA
  const loadExample = (key: string) => {
  const example = examplePDAs[key];
  setStates(example.states);
  setStartState(example.startState);
  setAcceptStates(example.acceptStates);
  setTransitions(example.transitions);
  setSimulationStatus('');
  setEngine(null);
  setInput('');
};

// Save configuration as JSON
const saveConfig = () => {
  const config = { states, startState, acceptStates, transitions };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pda-config.json';
  a.click();
  URL.revokeObjectURL(url);
};

return (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Pushdown Automata Visualizer
        </h1>
        <p className="text-gray-600 text-lg">
          Interactive tool for learning and visualizing PDAs
        </p>
      </div>

      {/* Example PDA Selector */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span className="text-lg">📚</span>
          Load Example PDA
        </h3>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => loadExample('balancedParentheses')} 
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors shadow-sm"
          >
            Balanced Parentheses
          </button>
          <button 
            onClick={() => loadExample('anbn')} 
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors shadow-sm"
          >
            aⁿbⁿ Language
          </button>
          <button 
            onClick={() => loadExample('palindrome')} 
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors shadow-sm"
          >
            Palindrome (Odd)
          </button>
          <button 
            onClick={saveConfig} 
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 ml-auto flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save size={16} /> Save Config
          </button>
        </div>
      </div>

      {/* Editor Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StateEditor
          states={states}
          onStatesChange={setStates}
          startState={startState}
          acceptStates={acceptStates}
          onStartStateChange={setStartState}
          onAcceptStatesChange={setAcceptStates}
        />
        <TransitionEditor
          transitions={transitions}
          states={states}
          onTransitionsChange={setTransitions}
        />
      </div>

      {/* Simulation Controls */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="font-semibold mb-4 text-lg flex items-center gap-2">
          <span className="text-xl">🎮</span>
          Simulation Controls
        </h3>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter input string (e.g., ()(), aabb, abcba)"
            className="border border-gray-300 px-4 py-3 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button 
            onClick={createEngine} 
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold shadow-sm"
          >
            Initialize PDA
          </button>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={stepForward}
            disabled={!engine || isRunning}
            className="bg-green-500 text-white px-5 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm font-semibold"
          >
            <SkipForward size={18} /> Step Forward
          </button>
          <button
            onClick={playSimulation}
            disabled={!engine || isRunning}
            className="bg-green-700 text-white px-5 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm font-semibold"
          >
            <Play size={18} /> {isRunning ? 'Running...' : 'Play All'}
          </button>
          <button
            onClick={resetSimulation}
            disabled={!engine}
            className="bg-orange-500 text-white px-5 py-3 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm font-semibold"
          >
            <RotateCcw size={18} /> Reset
          </button>
        </div>

        {/* Status Message */}
        {simulationStatus && (
          <div className={`mt-4 p-4 rounded-lg font-semibold text-lg ${
            simulationStatus.includes('✅') 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : simulationStatus.includes('❌')
              ? 'bg-red-100 text-red-800 border border-red-300'
              : 'bg-blue-100 text-blue-800 border border-blue-300'
          }`}>
            {simulationStatus}
          </div>
        )}
      </div>

      {/* Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <StateDiagram
            states={states}
            transitions={transitions}
            currentState={engine?.getCurrentState() || startState}
            startState={startState}
            acceptStates={acceptStates}
          />
        </div>
        
        <div>
          <StackVisualizer stack={engine?.getStack() || []} />
        </div>
      </div>

      {/* Input Tape */}
      <InputTape input={input} position={engine?.getInputPosition() || 0} />

      {/* Footer with instructions */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="font-semibold mb-3 text-lg">📖 How to Use</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Load an example PDA or create your own by defining states and transitions</li>
          <li>Mark your start state (radio button) and accept states (checkbox)</li>
          <li>Define transitions with format: Read symbol, Pop from stack, Push to stack</li>
          <li>Use ε (epsilon) or leave empty for no read/pop/push</li>
          <li>Enter an input string and click "Initialize PDA"</li>
          <li>Use "Step Forward" to see each transition or "Play All" to run automatically</li>
          <li>Watch the state diagram, stack, and input tape update in real-time!</li>
        </ol>
      </div>
    </div>
  </div>
);
}