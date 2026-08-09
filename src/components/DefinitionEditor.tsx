'use client';

// Configuration panel for states, alphabets, bottom marker and acceptance mode.

import React from 'react';

import type { AcceptanceMode } from '../types/pda';
import type { DefinitionDraft } from '../lib/definition';

interface DefinitionEditorProps {
  draft: DefinitionDraft;
  onUpdate: (draft: DefinitionDraft) => void;
  onClear: () => void;
}

export const DefinitionEditor: React.FC<DefinitionEditorProps> = ({
  draft,
  onUpdate,
  onClear,
}) => {
  const set = (key: keyof DefinitionDraft, value: string | AcceptanceMode) =>
    onUpdate({ ...draft, [key]: value });

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-head">
        <h3 className="sidebar-title">Configuration</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
          Clear All
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">States (comma-separated)</label>
        <input
          type="text"
          className="form-input"
          value={draft.states}
          onChange={e => set('states', e.target.value)}
          placeholder="q0, q1, q2*"
        />
        <p className="form-helper">
          The <strong>first</strong> state listed is the start state. Mark accept
          states with <code>*</code> (e.g., q2*).
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Input Alphabet</label>
        <input
          type="text"
          className="form-input"
          value={draft.inputAlphabet}
          onChange={e => set('inputAlphabet', e.target.value)}
          placeholder="a, b, c"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Stack Alphabet</label>
        <input
          type="text"
          className="form-input"
          value={draft.stackAlphabet}
          onChange={e => set('stackAlphabet', e.target.value)}
          placeholder="Z0, A, B"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Initial Stack Symbol (bottom marker)</label>
        <input
          type="text"
          className="form-input"
          value={draft.initialStackSymbol}
          onChange={e => set('initialStackSymbol', e.target.value)}
          placeholder="Z0 (leave empty for no marker)"
        />
        <p className="form-helper">Z₀ is the textbook default.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Acceptance Mode</label>
        <select
          className="form-select"
          value={draft.acceptance}
          onChange={e => set('acceptance', e.target.value as AcceptanceMode)}
        >
          <option value="final-state">Final state (textbook default)</option>
          <option value="empty-stack">Empty stack</option>
          <option value="final-state-and-empty-stack">Both</option>
        </select>
      </div>
    </div>
  );
};
