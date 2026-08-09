'use client';

// Stack visualisation.
//
// DPDA mode renders one stack. NPDA mode renders one card per live branch, with
// the selected branch called out, which is what makes "each branch has its own
// stack" visible rather than just asserted.

import React from 'react';

import type { BranchNode, ExecutionMode, SimulationTrace } from '../types/pda';
import { displaySymbol } from '../engine';

interface StackPanelProps {
  trace: SimulationTrace | null;
  frontier: readonly number[];
  mode: ExecutionMode;
  selectedBranch: number | null;
  onSelectBranch: (index: number) => void;
  initialStackSymbol: string | null;
  maxBranches?: number;
}

/** Z0 reads better as Z₀ but must not be confused with a real symbol name. */
function prettySymbol(symbol: string): string {
  return symbol === 'Z0' ? 'Z₀' : symbol;
}

function StackColumn({
  stack,
  initialStackSymbol,
  compact = false,
}: {
  stack: readonly string[];
  initialStackSymbol: string | null;
  compact?: boolean;
}) {
  if (stack.length === 0) {
    return <div className="stack-empty">empty</div>;
  }

  return (
    <div className={`stack-container${compact ? ' stack-container-compact' : ''}`}>
      {stack.map((symbol, index) => {
        const isTop = index === stack.length - 1;
        const isBottom = index === 0 && symbol === initialStackSymbol;
        return (
          <div
            key={`${index}-${symbol}`}
            className={`stack-cell${isTop ? ' top' : ''}${isBottom ? ' bottom-marker' : ''}`}
          >
            <span>{prettySymbol(symbol)}</span>
            {!compact && isTop && <span className="stack-tag text-accent">top</span>}
            {!compact && isBottom && !isTop && (
              <span className="stack-tag text-cyan">bottom</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function branchTone(node: BranchNode): string {
  switch (node.status) {
    case 'accepted':
      return 'accepted';
    case 'dead-end':
      return 'dead';
    case 'pruned-duplicate':
    case 'pruned-epsilon-cycle':
    case 'pruned-stack-depth':
      return 'pruned';
    default:
      return 'active';
  }
}

function statusLabel(node: BranchNode): string {
  switch (node.status) {
    case 'accepted':
      return 'accepted';
    case 'dead-end':
      return 'dead end';
    case 'pruned-duplicate':
      return 'already seen';
    case 'pruned-epsilon-cycle':
      return 'ε-cycle';
    case 'pruned-stack-depth':
      return 'stack limit';
    default:
      return 'active';
  }
}

export const StackPanel: React.FC<StackPanelProps> = ({
  trace,
  frontier,
  mode,
  selectedBranch,
  onSelectBranch,
  initialStackSymbol,
  maxBranches = 8,
}) => {
  const single = mode === 'dpda' || frontier.length <= 1;
  const focus = selectedBranch ?? frontier[0] ?? null;

  if (trace === null || focus === null) {
    return (
      <div className="viz-panel">
        <div className="viz-panel-header">
          <span className="viz-panel-title">Stack</span>
        </div>
        <div className="viz-panel-content">
          <div className="stack-empty">No live branches.</div>
        </div>
      </div>
    );
  }

  if (single) {
    const node = trace.nodes[focus];
    return (
      <div className="viz-panel">
        <div className="viz-panel-header">
          <span className="viz-panel-title">Stack</span>
          <span className="text-cyan">Height: {node.config.stack.length}</span>
        </div>
        <div className="viz-panel-content">
          <StackColumn
            stack={node.config.stack}
            initialStackSymbol={initialStackSymbol}
          />
        </div>
      </div>
    );
  }

  const shown = frontier.slice(0, maxBranches);
  const hidden = frontier.length - shown.length;

  return (
    <div className="viz-panel">
      <div className="viz-panel-header">
        <span className="viz-panel-title">Stacks</span>
        <span className="text-cyan">
          {frontier.length} branch{frontier.length === 1 ? '' : 'es'}
        </span>
      </div>
      <div className="viz-panel-content">
        <div className="branch-grid">
          {shown.map(index => {
            const node = trace.nodes[index];
            const selected = index === selectedBranch;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelectBranch(index)}
                aria-pressed={selected}
                className={`branch-card ${branchTone(node)}${selected ? ' selected' : ''}`}
              >
                <div className="branch-card-head">
                  <span className="branch-state">{node.config.state}</span>
                  <span className="branch-meta">
                    pos {node.config.inputPosition} · {statusLabel(node)}
                  </span>
                </div>
                <StackColumn
                  stack={node.config.stack}
                  initialStackSymbol={initialStackSymbol}
                  compact
                />
                {node.via && (
                  <div className="branch-via">
                    via {displaySymbol(node.via.read)}, {displaySymbol(node.via.pop)} →{' '}
                    {displaySymbol(node.via.push)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {hidden > 0 && (
          <div className="branch-overflow">
            +{hidden} more branch{hidden === 1 ? '' : 'es'} not shown
          </div>
        )}
      </div>
    </div>
  );
};
