'use client';

// Playback state for a precomputed trace.
//
// Because `simulate` returns the entire execution tree, playback here is nothing
// more than an index into `trace.steps`. Step-backward is a decrement, pause just
// clears the interval, and changing speed mid-run cannot desynchronise anything —
// all of which the old inline `while (true)` loop could not do.

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ExecutionMode,
  PDADefinition,
  SimulationLimits,
  SimulationTrace,
} from '../types/pda';
import { DEFAULT_LIMITS } from '../types/pda';
import { simulate } from '../engine';

export interface UsePDASimulationOptions {
  definition: PDADefinition | null;
  input: string;
  mode: ExecutionMode;
  limits?: SimulationLimits;
}

export const SPEED_MIN_MS = 80;
export const SPEED_MAX_MS = 1600;

/** Picks the frontier node to show when the user has not chosen one. */
function pickBranch(
  trace: SimulationTrace,
  frontier: readonly number[],
  preferred: number | null
): number | null {
  if (frontier.length === 0) return null;
  if (preferred !== null && frontier.includes(preferred)) return preferred;

  // Keep following the branch the user selected, if one of its descendants
  // is still alive in this frontier.
  if (preferred !== null) {
    for (const index of frontier) {
      let cursor: number | null = index;
      while (cursor !== null) {
        if (cursor === preferred) return index;
        cursor = trace.nodes[cursor].parent;
      }
    }
  }

  // Otherwise prefer the branch that ends up accepting, so the interesting path
  // is the one on screen.
  const onAcceptingPath = frontier.find(i => trace.acceptingPath.includes(i));
  return onAcceptingPath ?? frontier[0];
}

export function usePDASimulation({
  definition,
  input,
  mode,
  limits = DEFAULT_LIMITS,
}: UsePDASimulationOptions) {
  const trace = useMemo<SimulationTrace | null>(
    () => (definition === null ? null : simulate(definition, input, mode, limits)),
    [definition, input, mode, limits]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(420);
  const [preferredBranch, setPreferredBranch] = useState<number | null>(null);

  const lastStep = trace === null ? 0 : trace.steps.length - 1;

  // A new trace means a new machine or input, so playback rewinds. Done during
  // render via the documented "adjust state when props change" pattern rather than
  // in an effect, which would render one frame against the wrong trace first.
  const [tracedFor, setTracedFor] = useState(trace);
  if (trace !== tracedFor) {
    setTracedFor(trace);
    setStepIndex(0);
    setIsPlaying(false);
    setPreferredBranch(null);
  }

  // Playing past the end is meaningless, so treat the end as not-playing rather
  // than clearing the flag from an effect.
  const isPlayingNow = isPlaying && stepIndex < lastStep;

  // Advance on a timer while playing. Nothing is scheduled at the end of the
  // trace, so playback stops on its own.
  useEffect(() => {
    if (!isPlayingNow) return;
    const timer = setTimeout(() => setStepIndex(current => current + 1), speedMs);
    return () => clearTimeout(timer);
  }, [isPlayingNow, stepIndex, speedMs]);

  const play = useCallback(() => {
    if (trace === null) return;
    // Replay from the start once the end has been reached.
    setStepIndex(current => (current >= trace.steps.length - 1 ? 0 : current));
    setIsPlaying(true);
  }, [trace]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(() => {
    if (isPlayingNow) pause();
    else play();
  }, [isPlayingNow, pause, play]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setStepIndex(current => Math.min(current + 1, lastStep));
  }, [lastStep]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setStepIndex(current => Math.max(current - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setStepIndex(0);
    setPreferredBranch(null);
  }, []);

  const jumpToEnd = useCallback(() => {
    setIsPlaying(false);
    setStepIndex(lastStep);
  }, [lastStep]);

  const step = trace?.steps[Math.min(stepIndex, lastStep)] ?? null;
  const frontier = step?.frontier ?? [];
  const selectedBranch = trace === null ? null : pickBranch(trace, frontier, preferredBranch);

  /** Root-to-selected path, used for the step log and diagram highlighting. */
  const selectedPath = useMemo(() => {
    if (trace === null || selectedBranch === null) return [];
    const path: number[] = [];
    let cursor: number | null = selectedBranch;
    while (cursor !== null) {
      path.push(cursor);
      cursor = trace.nodes[cursor].parent;
    }
    return path.reverse();
  }, [trace, selectedBranch]);

  const atEnd = stepIndex >= lastStep;

  return {
    trace,
    step,
    frontier,
    stepIndex,
    lastStep,
    atEnd,
    isPlaying: isPlayingNow,
    speedMs,
    setSpeedMs,
    selectedBranch,
    selectBranch: setPreferredBranch,
    selectedPath,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    reset,
    jumpToEnd,
    setStepIndex,
  };
}

export type PDASimulation = ReturnType<typeof usePDASimulation>;
