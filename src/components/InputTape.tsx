
// src/components/InputTape.tsx
// Visual representation of the input string

'use client';

import React from 'react';

interface InputTapeProps {
  input: string;
  position: number;
}

export const InputTape: React.FC<InputTapeProps> = ({ input, position }) => {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold mb-4 text-center text-lg">Input Tape</h3>
      <div className="flex gap-1 justify-center flex-wrap">
        {input.split('').map((char, index) => (
          <div
            key={index}
            className={`w-12 h-12 flex items-center justify-center border-2 rounded font-mono text-lg transition-all duration-300 ${
              index === position
                ? 'bg-yellow-200 border-yellow-500 scale-110 shadow-lg'
                : index < position
                ? 'bg-gray-200 border-gray-400 opacity-50'
                : 'bg-white border-gray-300'
            }`}
          >
            {char}
          </div>
        ))}
        {input.length === 0 && (
          <div className="text-gray-400 italic">No input</div>
        )}
      </div>
    </div>
  );
};