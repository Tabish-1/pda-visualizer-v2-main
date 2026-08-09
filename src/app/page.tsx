'use client';

// Main page: state, handlers, hooks.

import { useCallback, useMemo, useRef, useState } from 'react';

import type { DeterminismReport, ExecutionMode, PDADefinition, Transition } from '../types/pda';
import {
  analyseDeterminism,
  cloneDefinition,
  exampleByKey,
  examples,
  validateDefinition,
  validateInput,
} from '../engine';
import { usePDASimulation } from '../hooks/usePDASimulation';
import type { DefinitionDraft } from '../lib/definition';
import {
  parseDraft,
  parseDefinitionFile,
  serialiseDefinition,
  toDraft,
} from '../lib/definition';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { DefinitionEditor } from '../components/DefinitionEditor';
import { InputTape } from '../components/InputTape';
import { PlaybackControls } from '../components/PlaybackControls';
import { StackPanel } from '../components/StackPanel';
import { StateDiagram } from '../components/StateDiagram';
import { StepLog } from '../components/StepLog';
import { TransitionEditor } from '../components/TransitionEditor';

import { useKeyboard } from '../hooks/useKeyboard';
import { useTheme } from '../hooks/useTheme';
import { HowItWorks } from '../components/HowItWorks';

/** Blank slate used by Clear All. */
const EMPTY_DRAFT: DefinitionDraft = {
  states: 'q0, q1*',
  inputAlphabet: 'a, b',
  stackAlphabet: 'Z0, A',
  initialStackSymbol: 'Z0',
  acceptance: 'final-state',
};

const FIRST_EXAMPLE = examples[0];

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  // Seeded straight from the first example rather than loaded in a mount effect.
  // Doing it in an effect meant the first render simulated a machine with no
  // transitions, so the server-rendered banner read "Rejected" until hydration.
  const [name, setName] = useState(FIRST_EXAMPLE.definition.name);
  const [draft, setDraft] = useState<DefinitionDraft>(() =>
    toDraft(FIRST_EXAMPLE.definition)
  );
  const [transitions, setTransitions] = useState<Transition[]>(() =>
    FIRST_EXAMPLE.definition.transitions.map(t => ({ ...t }))
  );
  const [testInput, setTestInput] = useState(FIRST_EXAMPLE.testString);
  const [mode, setMode] = useState<ExecutionMode>(FIRST_EXAMPLE.mode);
  const [selectedExample, setSelectedExample] = useState<string>(FIRST_EXAMPLE.key);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const definition = useMemo<PDADefinition | null>(() => {
    try {
      return parseDraft(draft, transitions, name);
    } catch {
      return null;
    }
  }, [draft, transitions, name]);

  const validationIssues = useMemo(() => {
    if (definition === null) return [];
    return [
      ...validateDefinition(definition),
      ...validateInput(definition, testInput),
    ];
  }, [definition, testInput]);

  const determinismReport = useMemo<DeterminismReport | null>(() => {
    return definition === null ? null : analyseDeterminism(definition);
  }, [definition]);

  const hasErrors =
    validationIssues.some(i => i.severity === 'error') || definition === null;

  const simulation = usePDASimulation({
    definition: hasErrors ? null : definition,
    input: testInput,
    mode,
  });

  const { trace, step, frontier } = simulation;

  const loadExample = useCallback((key: string) => {
    const example = exampleByKey[key];
    const def = cloneDefinition(example.definition);
    setName(def.name);
    setDraft(toDraft(def));
    setTransitions([...def.transitions]);
    setTestInput(example.testString);
    setMode(example.mode);
    setSelectedExample(key);
  }, []);

  // Hand edits mean the machine is no longer the example it came from.
  const updateDraft = useCallback((next: DefinitionDraft) => {
    setDraft(next);
    setSelectedExample('');
  }, []);

  const updateTransitions = useCallback((next: Transition[]) => {
    setTransitions(next);
    setSelectedExample('');
  }, []);

  const saveConfig = useCallback(() => {
    if (definition === null) return;
    const json = serialiseDefinition(definition, testInput);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-')}.pda.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [definition, testInput, name]);

  const loadConfig = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const { definition: loaded, testString } = parseDefinitionFile(
          evt.target?.result as string
        );
        setName(loaded.name);
        setDraft(toDraft(loaded));
        setTransitions([...loaded.transitions]);
        setTestInput(testString);
        setMode('dpda');
        setSelectedExample('');
      } catch (err) {
        alert(`Failed to load: ${String(err)}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  const clearAll = useCallback(() => {
    setName('Custom PDA');
    setDraft(EMPTY_DRAFT);
    setTransitions([]);
    setTestInput('');
    setSelectedExample('');
  }, []);

  useKeyboard({
    onReset: simulation.reset,
    onStepForward: simulation.stepForward,
    onStepBackward: simulation.stepBackward,
    onTogglePlay: simulation.togglePlay,
  });

  const conflictIds = new Set(
    determinismReport?.conflicts.flatMap(c => c.transitionIds) ?? []
  );

  // Diagram state: which nodes are active, which transitions fire to reach them.
  const activeStates = useMemo(
    () => new Set(frontier.map(i => trace?.nodes[i].config.state ?? '')),
    [trace, frontier]
  );
  const acceptedStates = useMemo(
    () =>
      new Set(
        frontier
          .filter(i => trace?.nodes[i].status === 'accepted')
          .map(i => trace?.nodes[i].config.state ?? '')
      ),
    [trace, frontier]
  );
  const deadStates = useMemo(
    () =>
      new Set(
        frontier
          .filter(i => trace?.nodes[i].status === 'dead-end')
          .map(i => trace?.nodes[i].config.state ?? '')
      ),
    [trace, frontier]
  );
  const activeTransitionIds = useMemo(
    () =>
      new Set(
        frontier
          .flatMap(i => (trace?.nodes[i].via ? [trace.nodes[i].via!.id] : []))
      ),
    [trace, frontier]
  );

  // JSX follows in the next chunk...

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>PDA Visualiser</h1>
          <span className="app-subtitle">Interactive Pushdown Automata Simulator</span>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Examples</h3>
            <div className="example-grid">
              {examples.map(example => (
                <button
                  key={example.key}
                  type="button"
                  className={`example-card${
                    example.key === selectedExample ? ' active' : ''
                  }`}
                  onClick={() => loadExample(example.key)}
                >
                  <span className="example-name">{example.definition.name}</span>
                  <span className="example-desc">{example.description}</span>
                  <span className={`example-mode mode-${example.mode}`}>
                    {example.mode.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Import / Export</h3>
            <div className="file-actions">
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => fileInputRef.current?.click()}
              >
                ↑ Load from file
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={saveConfig}
                disabled={definition === null}
              >
                ↓ Save to file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.pda.json"
                onChange={loadConfig}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <DefinitionEditor draft={draft} onUpdate={updateDraft} onClear={clearAll} />
          <TransitionEditor
            transitions={transitions}
            onUpdate={updateTransitions}
            conflictIds={conflictIds}
          />
        </aside>

        <main className="main-content">
          <div className="viz-panel">
            <div className="viz-panel-header">
              <span className="viz-panel-title">State Diagram</span>
              <div className="mode-toggle">
                <label>
                  <input
                    type="radio"
                    value="dpda"
                    checked={mode === 'dpda'}
                    onChange={() => setMode('dpda')}
                  />
                  DPDA
                </label>
                <label>
                  <input
                    type="radio"
                    value="npda"
                    checked={mode === 'npda'}
                    onChange={() => setMode('npda')}
                  />
                  NPDA
                </label>
              </div>
            </div>
            {definition && (
              <StateDiagram
                definition={definition}
                state={{ active: activeStates, accepted: acceptedStates, dead: deadStates, activeTransitions: activeTransitionIds }}
                theme={theme}
              />
            )}
          </div>

          <div className="viz-grid">
            <StackPanel
              trace={trace}
              frontier={frontier}
              mode={mode}
              selectedBranch={simulation.selectedBranch}
              onSelectBranch={simulation.selectBranch}
              initialStackSymbol={definition?.initialStackSymbol ?? null}
            />
            <InputTape input={testInput} position={step?.maxInputPosition ?? 0} />
          </div>

          {/* Above the controls on purpose: an error disables Play, and the reason
              has to be visible without scrolling past the dead button. */}
          <AnalysisPanel issues={validationIssues} determinismReport={determinismReport} />

          <div className="viz-panel">
            <div className="viz-panel-header">
              <span className="viz-panel-title">Simulation</span>
              {trace && (
                <span className={`verdict verdict-${trace.verdict}`}>
                  {trace.verdict}
                </span>
              )}
            </div>
            <div className="viz-panel-content">
              <div className="input-row">
                <input
                  type="text"
                  className="form-input"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  placeholder="Type input string"
                />
              </div>
              <PlaybackControls simulation={simulation} disabled={hasErrors} />
              {trace && <p className="sim-message">{trace.message}</p>}
            </div>
          </div>

          <StepLog trace={trace} path={simulation.selectedPath} />
          <HowItWorks />
        </main>
      </div>
    </div>
  );
}