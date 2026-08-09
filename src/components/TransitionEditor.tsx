'use client';

// Transition table with add/remove and conflict highlighting.

import React, { useId, useState } from 'react';

import type { Transition } from '../types/pda';
import { formatTransition } from '../engine';
import { nextTransitionId } from '../lib/definition';

interface TransitionEditorProps {
  transitions: Transition[];
  onUpdate: (transitions: Transition[]) => void;
  conflictIds: Set<string>;
}

export const TransitionEditor: React.FC<TransitionEditorProps> = ({
  transitions,
  onUpdate,
  conflictIds,
}) => {
  const formId = useId();
  const [formData, setFormData] = useState<Record<string, string>>({
    from: '',
    read: '',
    pop: '',
    push: '',
    to: '',
  });

  const set = (key: string, value: string) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const add = () => {
    if (!formData.from || !formData.to) return;
    onUpdate([
      ...transitions,
      {
        id: nextTransitionId(transitions),
        from: formData.from,
        read: formData.read || 'ε',
        pop: formData.pop || 'ε',
        push: formData.push || 'ε',
        to: formData.to,
      },
    ]);
    setFormData({ from: '', read: '', pop: '', push: '', to: '' });
  };

  const remove = (id: string) =>
    onUpdate(transitions.filter(t => t.id !== id));

  return (
    <div className="sidebar-section">
      <h3 className="sidebar-title">Add Transition</h3>
      <div className="form-grid transition-form">
        <input
          id={`${formId}-from`}
          type="text"
          className="form-input"
          placeholder="From state"
          value={formData.from}
          onChange={e => set('from', e.target.value)}
        />
        <input
          id={`${formId}-read`}
          type="text"
          className="form-input"
          placeholder="Read (ε)"
          value={formData.read}
          onChange={e => set('read', e.target.value)}
        />
        <input
          id={`${formId}-pop`}
          type="text"
          className="form-input"
          placeholder="Pop (ε)"
          value={formData.pop}
          onChange={e => set('pop', e.target.value)}
        />
        <input
          id={`${formId}-push`}
          type="text"
          className="form-input"
          placeholder="Push (ε)"
          value={formData.push}
          onChange={e => set('push', e.target.value)}
        />
        <input
          id={`${formId}-to`}
          type="text"
          className="form-input"
          placeholder="To state"
          value={formData.to}
          onChange={e => set('to', e.target.value)}
        />
      </div>
      <button type="button" className="btn btn-primary btn-full" onClick={add}>
        Add Transition
      </button>

      {transitions.length > 0 && (
        <>
          <h3 className="sidebar-title mt-4">Transitions ({transitions.length})</h3>
          <div className="transition-list">
            {transitions.map(t => (
              <div
                key={t.id}
                className={`transition-item${conflictIds.has(t.id) ? ' conflict' : ''}`}
              >
                {/* Full δ(q, a, X) → (p, γ) form: the target state has to be
                    visible or the list cannot be proof-read. */}
                <span>{formatTransition(t)}</span>
                <button
                  type="button"
                  className="transition-remove"
                  onClick={() => remove(t.id)}
                  aria-label={`Remove transition ${t.id}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
