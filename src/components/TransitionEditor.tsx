// src/components/TransitionEditor.tsx
// Component for editing PDA transitions

'use client';

import React, { useState } from 'react';
import { Transition } from '../types/pda.types';

interface TransitionEditorProps {
  transitions: Transition[];
  states: string[];
  onTransitionsChange: (transitions: Transition[]) => void;
}

export const TransitionEditor: React.FC<TransitionEditorProps> = ({
  transitions,
  states,
  onTransitionsChange
}) => {
  const [newTransition, setNewTransition] = useState<Transition>({
    from: '',
    to: '',
    read: '',
    pop: '',
    push: ''
  });

  const addTransition = () => {
    if (newTransition.from && newTransition.to) {
      onTransitionsChange([...transitions, { ...newTransition }]);
      setNewTransition({ from: '', to: '', read: '', pop: '', push: '' });
    }
  };

  const removeTransition = (index: number) => {
    onTransitionsChange(transitions.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-semibold mb-3 text-lg">Define Transitions</h3>
      <div className="grid grid-cols-5 gap-2 mb-4">
        <select
          value={newTransition.from}
          onChange={(e) => setNewTransition({ ...newTransition, from: e.target.value })}
          className="border px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">From</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        <input
          type="text"
          placeholder="Read (ε=empty)"
          value={newTransition.read}
          onChange={(e) => setNewTransition({ ...newTransition, read: e.target.value })}
          className="border px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <input
          type="text"
          placeholder="Pop (ε=empty)"
          value={newTransition.pop}
          onChange={(e) => setNewTransition({ ...newTransition, pop: e.target.value })}
          className="border px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <input
          type="text"
          placeholder="Push (ε=empty)"
          value={newTransition.push}
          onChange={(e) => setNewTransition({ ...newTransition, push: e.target.value })}
          className="border px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <select
          value={newTransition.to}
          onChange={(e) => setNewTransition({ ...newTransition, to: e.target.value })}
          className="border px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">To</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      
      <button 
        onClick={addTransition} 
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full mb-4"
      >
        Add Transition
      </button>
      
      <div className="max-h-60 overflow-y-auto space-y-1">
        {transitions.map((t, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
            <span className="font-mono">
              {t.from} → {t.to} | {t.read || 'ε'}, {t.pop || 'ε'} → {t.push || 'ε'}
            </span>
            <button 
              onClick={() => removeTransition(i)} 
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