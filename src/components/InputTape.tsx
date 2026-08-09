'use client';

// Input tape with the read head at the current position.

import React from 'react';

interface InputTapeProps {
  input: string;
  position: number;
  /** Shown when several branches sit at different positions. */
  spread?: number[];
}

export const InputTape: React.FC<InputTapeProps> = ({ input, position, spread }) => {
  const heads = new Set(spread ?? [position]);

  return (
    <div className="viz-panel">
      <div className="viz-panel-header">
        <span className="viz-panel-title">Input Tape</span>
        <span className="text-accent">
          Position: {position}
          {input.length > 0 ? ` / ${input.length}` : ''}
        </span>
      </div>
      <div className="viz-panel-content">
        {input.length === 0 ? (
          <span className="tape-note">
            Empty input — the machine still runs its ε-moves.
          </span>
        ) : (
          <div className="tape-container">
            {input.split('').map((char, index) => {
              const consumed = index < position;
              const isHead = heads.has(index);
              return (
                <div
                  key={index}
                  className={`tape-cell${isHead ? ' current' : ''}${
                    consumed && !isHead ? ' consumed' : ''
                  }`}
                >
                  {char}
                </div>
              );
            })}
            <div className={`tape-cell tape-end${position >= input.length ? ' current' : ''}`}>
              ⊣
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
