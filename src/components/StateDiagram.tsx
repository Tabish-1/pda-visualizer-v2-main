'use client';

// Canvas host for the state diagram.
//
// The component owns only the things React is good at here: refs, sizing and
// invalidation. All drawing lives in renderDiagram. Redraws are driven by a
// ResizeObserver and by the `theme` prop, so the diagram no longer keeps stale
// colours after a theme toggle or stale geometry after a window resize.

import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import type { PDADefinition } from '../types/pda';
import { computeLayout } from '../lib/layout';
import {
  renderDiagram,
  type DiagramColors,
  type DiagramState,
} from '../lib/renderDiagram';

interface StateDiagramProps {
  definition: PDADefinition;
  state: DiagramState;
  /** Only used to force a redraw when the palette changes. */
  theme: string;
  height?: number;
}

const COLOR_KEYS: Array<keyof DiagramColors> = [
  'text',
  'text2',
  'accent',
  'border',
  'surface',
  'green',
  'red',
  'cyan',
];

/** Reads the live palette so the canvas matches the active theme. */
function readColors(): DiagramColors {
  const styles = getComputedStyle(document.documentElement);
  const colors = {} as DiagramColors;
  for (const key of COLOR_KEYS) {
    colors[key] = styles.getPropertyValue(`--${key}`).trim() || '#888888';
  }
  return colors;
}

export const StateDiagram: React.FC<StateDiagramProps> = ({
  definition,
  state,
  theme,
  height = 420,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const retryRef = useRef(0);
  /** Lets the zero-size retry below call the latest draw without a cyclic dep. */
  const drawRef = useRef<() => void>(() => {});
  const layout = useMemo(() => computeLayout(definition), [definition]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    // Layout may not have happened yet on the first effect pass. Retry next frame
    // instead of returning, so the paint never depends on a later resize to arrive.
    if (rect.width === 0 || rect.height === 0) {
      retryRef.current = requestAnimationFrame(() => drawRef.current());
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    // Reassigning width/height clears the canvas, so only do it on real change.
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderDiagram({
      ctx,
      width: rect.width,
      height: rect.height,
      layout,
      definition,
      colors: readColors(),
      state,
    });
  }, [definition, layout, state]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // `theme` is not read by draw itself; it is a dependency so a toggle repaints.
  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(retryRef.current);
  }, [draw, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      // Coalesce bursts of resize callbacks into one paint per frame.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="state-canvas"
      style={{ height }}
      role="img"
      aria-label={`State diagram for ${definition.name || 'the current PDA'}`}
    />
  );
};
