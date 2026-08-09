'use client';

// Displays validation errors and determinism conflicts.

import React from 'react';

import type { DeterminismReport, ValidationIssue } from '../types/pda';

interface AnalysisPanelProps {
  issues: ValidationIssue[];
  determinismReport: DeterminismReport | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  issues,
  determinismReport,
}) => {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const hardConflicts =
    determinismReport?.conflicts.filter(c => c.kind === 'hard') ?? [];
  const softConflicts =
    determinismReport?.conflicts.filter(c => c.kind === 'soft') ?? [];

  const allFine =
    errors.length === 0 &&
    warnings.length === 0 &&
    hardConflicts.length === 0 &&
    softConflicts.length === 0;

  if (allFine) return null;

  return (
    <div className="analysis-panel">
      {errors.length > 0 && (
        <div className="issue-block error">
          <h4>Errors</h4>
          {errors.map((issue, i) => (
            <div key={i} className="issue-item">
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="issue-block warning">
          <h4>Warnings</h4>
          {warnings.map((issue, i) => (
            <div key={i} className="issue-item">
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {hardConflicts.length > 0 && (
        <div className="issue-block error">
          <h4>Nondeterministic (Hard)</h4>
          <p className="issue-explanation">
            These transitions compete in a way DPDA mode cannot resolve. Switch to
            NPDA or remove one of each pair.
          </p>
          {hardConflicts.map((conflict, i) => (
            <div key={i} className="issue-item">
              {conflict.description}
            </div>
          ))}
        </div>
      )}

      {softConflicts.length > 0 && (
        <div className="issue-block info">
          <h4>Soft Conflicts (ε-priority resolved)</h4>
          <p className="issue-explanation">
            These ε-moves compete with consuming moves. DPDA mode follows the
            consuming move when input remains and the ε-move at end of input, which
            is the standard convention and lets many textbook DPDAs work without
            being flagged. Be aware NPDA mode may accept a larger language.
          </p>
          {softConflicts.map((conflict, i) => (
            <div key={i} className="issue-item">
              {conflict.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
