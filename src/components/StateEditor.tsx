
// Component for editing PDA states

'use client';

import React, { useState } from 'react';

interface StateEditorProps {
  states: string[];
  onStatesChange: (states: string[]) => void;
  startState: string;
  acceptStates: string[];
  onStartStateChange: (state: string) => void;
  onAcceptStatesChange: (states: string[]) => void;
}

export const StateEditor: React.FC<StateEditorProps> = ({
  states,
  onStatesChange,
  startState,
  acceptStates,
  onStartStateChange,
  onAcceptStatesChange
}) => {
  const [newState, setNewState] = useState('');

  const addState = () => {
    if (newState && !states.includes(newState)) {
      onStatesChange([...states, newState]);
      setNewState('');
    }
  };

  const removeState = (state: string) => {
    onStatesChange(states.filter(s => s !== state));
    if (startState === state) onStartStateChange('');
    onAcceptStatesChange(acceptStates.filter(s => s !== state));
  };

  const toggleAcceptState = (state: string) => {
    if (acceptStates.includes(state)) {
      onAcceptStatesChange(acceptStates.filter(s => s !== state));
    } else {
      onAcceptStatesChange([...acceptStates, state]);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-semibold mb-3 text-lg">Define States</h3>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newState}
          onChange={(e) => setNewState(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addState()}
          placeholder="State name (e.g., q0)"
          className="border px-3 py-2 rounded flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button 
          onClick={addState} 
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add
        </button>
      </div>
      
      <div className="space-y-2">
        {states.map(state => (
          <div key={state} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
            <span className="flex-1 font-mono">{state}</span>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                checked={startState === state}
                onChange={() => onStartStateChange(state)}
              />
              Start
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={acceptStates.includes(state)}
                onChange={() => toggleAcceptState(state)}
              />
              Accept
            </label>
            <button 
              onClick={() => removeState(state)} 
              className="text-red-500 hover:text-red-700 px-2"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};