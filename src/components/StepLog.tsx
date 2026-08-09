'use client';

// Derived step log that renders the path to the selected branch.
//
// Unlike the old append-only log that could only move forward, this one is
// computed from the trace, so it correctly reflects step-backward.

import React from 'react';

import type { SimulationTrace } from '../types/pda';
import { displaySymbol } from '../engine';

interface StepLogProps {
  trace: SimulationTrace | null;
  path: readonly number[];
}

export const StepLog: React.FC<StepLogProps> = ({ trace, path }) => {
  if (trace === null) {
    return (
      <div className="step-log">
        <div className="step-log-header">
          <span className="step-log-title">Step Log</span>
        </div>
        <div className="step-log-content">
          <p className="step-note">No trace yet — load an example or define a machine.</p>
        </div>
      </div>
    );
  }

  const lines: string[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const node = trace.nodes[path[i]];
    const via = node.via;
    if (via === null) continue;

    const read = displaySymbol(node.consumed ?? via.read);
    const pop = displaySymbol(via.pop);
    const push = displaySymbol(via.push);
    const stack = node.config.stack;
    const top = stack.length > 0 ? stack[stack.length - 1] : '∅';
    lines.push(
      `${i}. δ(${via.from}, ${read}, ${pop}) → (${via.to}, ${push}) · stack top now ${top}`
    );
  }

  if (lines.length === 0 && trace.steps.length > 0) {
    lines.push('Root configuration — no transitions taken yet.');
  }

  return (
    <div className="step-log">
      <div className="step-log-header">
        <span className="step-log-title">Step Log</span>
        <span className="text-cyan">{lines.length} step{lines.length === 1 ? '' : 's'}</span>
      </div>
      <div className="step-log-content">
        {lines.length === 0 ? (
          <p className="step-note">
            {trace.message}
          </p>
        ) : (
          lines.map((line, index) => (
            <div key={index} className="step-item">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
