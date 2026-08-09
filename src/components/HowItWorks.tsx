'use client';

// How-it-works guide, collapsible.

import React, { useState } from 'react';

export const HowItWorks: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="how-it-works">
      <button
        type="button"
        className="how-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        📖 How to Use
        <span className="how-toggle-icon">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="how-content">
          <section>
            <h3>Getting Started</h3>
            <ol>
              <li>Load a built-in example from the sidebar to see a working PDA.</li>
              <li>
                Or configure your own: type a comma-separated state list (mark accept
                states with <code>*</code>), define alphabets, and add transitions.
              </li>
              <li>Type an input string and click <strong>Play</strong>.</li>
            </ol>
          </section>

          <section>
            <h3>DPDA vs NPDA Mode</h3>
            <p>
              <strong>DPDA</strong> follows one path by preferring input-consuming
              moves over ε-moves. <strong>NPDA</strong> explores every possible path
              in parallel. Some languages need nondeterminism; the built-in wwᴿ and
              aⁱbʲcᵏ examples accept strings in NPDA mode that DPDA rejects.
            </p>
          </section>

          <section>
            <h3>Controls</h3>
            <ul>
              <li>
                <strong>Play</strong> runs all transitions to the end or until an
                accepting configuration is found.
              </li>
              <li>
                <strong>Step Forward</strong> and <strong>Step Backward</strong> move
                one transition at a time.
              </li>
              <li>
                <strong>Reset</strong> returns to the starting configuration.
              </li>
              <li>
                <strong>Speed slider</strong> adjusts how long each step takes.
              </li>
              <li>The scrubber lets you jump to any step in the trace.</li>
            </ul>
            <p>Keyboard: Space = play/pause, ← and → = step, R = reset.</p>
          </section>

          <section>
            <h3>Stack Convention</h3>
            <p>
              The simulator uses a <strong>bottom marker</strong> (Z₀ by default) and
              writes pushes <strong>left to right</strong>, so <code>AZ0</code> puts
              Z₀ at the bottom and A on top. That matches the textbook notation{' '}
              <code>δ(q, a, X) → (p, YZ)</code>.
            </p>
          </section>

          <section>
            <h3>Acceptance</h3>
            <p>
              The default is <strong>final-state</strong> acceptance: the machine
              accepts when it reaches a marked state and the input is fully consumed.
              You can also choose empty-stack or both from the config panel.
            </p>
          </section>

          <section>
            <h3>Save and Load</h3>
            <p>
              Use <strong>Save to file</strong> to export your PDA as JSON and load it
              later with <strong>Load from file</strong>.
            </p>
          </section>
        </div>
      )}
    </div>
  );
};
