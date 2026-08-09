'use client';

// Transport controls for the trace: step back, play/pause, step forward, jump to
// end, reset, speed, and a scrubber over the whole run.

import React from 'react';

import type { PDASimulation } from '../hooks/usePDASimulation';
import { SPEED_MAX_MS, SPEED_MIN_MS } from '../hooks/usePDASimulation';

interface PlaybackControlsProps {
  simulation: PDASimulation;
  disabled?: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  simulation,
  disabled = false,
}) => {
  const {
    stepIndex,
    lastStep,
    isPlaying,
    speedMs,
    setSpeedMs,
    play,
    pause,
    stepForward,
    stepBackward,
    reset,
    jumpToEnd,
    setStepIndex,
  } = simulation;

  const atStart = stepIndex === 0;
  const atEnd = stepIndex >= lastStep;

  return (
    <div className="playback">
      <div className="playback-buttons">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={stepBackward}
          disabled={disabled || atStart}
          title="Step backward (←)"
        >
          ⏴ Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={isPlaying ? pause : play}
          disabled={disabled || (lastStep === 0 && !isPlaying)}
          title="Play or pause (Space)"
        >
          {isPlaying ? '⏸ Pause' : atEnd && lastStep > 0 ? '↻ Replay' : '▶ Play'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={stepForward}
          disabled={disabled || atEnd}
          title="Step forward (→)"
        >
          Forward ⏵
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={jumpToEnd}
          disabled={disabled || atEnd}
          title="Jump to the end of the run"
        >
          ⏭ End
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={reset}
          disabled={disabled}
          title="Reset to the start (R)"
        >
          ↺ Reset
        </button>
      </div>

      <div className="playback-meters">
        <label className="playback-scrub">
          <span className="playback-label">
            Step {stepIndex} / {lastStep}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(lastStep, 0)}
            value={stepIndex}
            onChange={event => setStepIndex(Number(event.target.value))}
            disabled={disabled || lastStep === 0}
            aria-label="Scrub through the run"
          />
        </label>

        <label className="playback-speed">
          <span className="playback-label">Speed</span>
          <input
            type="range"
            min={SPEED_MIN_MS}
            max={SPEED_MAX_MS}
            step={20}
            // Inverted so dragging right is faster, which is what the label implies.
            value={SPEED_MAX_MS + SPEED_MIN_MS - speedMs}
            onChange={event =>
              setSpeedMs(SPEED_MAX_MS + SPEED_MIN_MS - Number(event.target.value))
            }
            aria-label="Playback speed"
          />
          <span className="playback-speed-value">{speedMs} ms</span>
        </label>
      </div>
    </div>
  );
};
