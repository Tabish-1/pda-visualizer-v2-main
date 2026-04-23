
// src/components/StackVisualizer.tsx
// Visual representation of the PDA stack

'use client';

import React from 'react';

interface StackVisualizerProps {
  stack: string[];
}

export const StackVisualizer: React.FC<StackVisualizerProps> = ({ stack }) => {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold mb-4 text-center text-lg">Stack</h3>
      <div className="flex flex-col-reverse items-center gap-1 min-h-[200px]">
        {stack.length === 0 ? (
          <div className="text-gray-400 italic">Empty Stack</div>
        ) : (
          stack.map((symbol, index) => (
            <div
              key={index}
              className="w-24 h-12 bg-blue-500 text-white flex items-center justify-center rounded border-2 border-blue-700 font-mono text-lg transition-all duration-300 animate-fadeIn"
            >
              {symbol}
            </div>
          ))
        )}
      </div>
      <div className="mt-4 text-center text-sm text-gray-600">↑ Top</div>
    </div>
  );
};