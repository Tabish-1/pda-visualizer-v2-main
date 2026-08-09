// Pure canvas renderer for the state diagram.
//
// Kept free of React so it can be called from an effect, a ResizeObserver and a
// theme change without any of them needing to know about the others. Every colour
// arrives through `colors`, so the caller re-reads CSS custom properties on each
// draw and the diagram never keeps stale theme colours.

import type { PDADefinition } from '../types/pda';
import { formatTransitionLabel } from '../engine';
import type { Layout, Point } from './layout';

export interface DiagramColors {
  text: string;
  text2: string;
  accent: string;
  border: string;
  surface: string;
  green: string;
  red: string;
  cyan: string;
}

export interface DiagramState {
  /** States holding at least one live branch right now. */
  active: ReadonlySet<string>;
  /** States of accepting configurations at this step. */
  accepted: ReadonlySet<string>;
  /** States whose branch died here. */
  dead: ReadonlySet<string>;
  /** Transitions used to reach the current frontier. */
  activeTransitions: ReadonlySet<string>;
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  layout: Layout;
  definition: PDADefinition;
  colors: DiagramColors;
  state: DiagramState;
}

const PADDING = 60;
const BASE_RADIUS = 26;
const LABEL_LINE_HEIGHT = 14;

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  size: number
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - size * Math.cos(angle - Math.PI / 6),
    y - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x - size * Math.cos(angle + Math.PI / 6),
    y - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draws stacked labels with a backing plate so they stay readable over edges. */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  color: string,
  colors: DiagramColors,
  fontSize: number
): void {
  ctx.font = `600 ${fontSize}px var(--font-code), monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
  const lineHeight = LABEL_LINE_HEIGHT * (fontSize / 11);
  const boxHeight = lines.length * lineHeight + 6;
  const top = y - boxHeight / 2;

  ctx.globalAlpha = 0.92;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x - widest / 2 - 5, top, widest + 10, boxHeight);
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, top + 3 + lineHeight * (i + 0.5));
  });
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  definition: PDADefinition,
  layout: Layout,
  toScreen: (p: Point) => Point,
  radius: number,
  colors: DiagramColors,
  state: DiagramState,
  scale: number
): void {
  for (const stateName of definition.states) {
    const point = layout.positions[stateName];
    if (!point) continue;

    const centre = toScreen(point);
    const isAccept = definition.acceptStates.includes(stateName);
    const isStart = stateName === definition.startState;
    const isActive = state.active.has(stateName);
    const isAccepted = state.accepted.has(stateName);
    const isDead = state.dead.has(stateName);

    // Green wins over red: a state that accepted on one branch and died on
    // another is more usefully shown as an acceptance.
    const highlight = isAccepted
      ? colors.green
      : isDead
      ? colors.red
      : isActive
      ? colors.accent
      : null;

    if (highlight !== null) {
      ctx.save();
      ctx.shadowColor = highlight;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      ctx.restore();
    }

    // Opaque body so edges passing behind do not show through the label.
    // Highlighted states are filled solid; the label then draws in the surface
    // colour for contrast against it.
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = highlight ?? colors.surface;
    ctx.fill();
    ctx.lineWidth = highlight !== null ? 3 : 2;
    ctx.strokeStyle = highlight ?? (isAccept ? colors.green : colors.border);
    ctx.stroke();

    if (isAccept) {
      // Inner ring of the double circle. On a filled node it has to contrast
      // against the fill, not repeat it.
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius - 5, 0, Math.PI * 2);
      ctx.strokeStyle = highlight !== null ? colors.surface : colors.green;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    if (isStart) {
      const tail = radius + 26 * Math.max(scale, 0.6);
      ctx.beginPath();
      ctx.moveTo(centre.x - tail, centre.y);
      ctx.lineTo(centre.x - radius - 2, centre.y);
      ctx.strokeStyle = colors.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawArrowHead(ctx, centre.x - radius - 2, centre.y, 0, colors.cyan, 8);
    }

    const labelSize = Math.max(11, Math.round(14 * Math.max(scale, 0.8)));
    ctx.fillStyle = highlight !== null ? colors.surface : colors.text;
    ctx.font = `700 ${labelSize}px var(--font-code), monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stateName, centre.x, centre.y);
  }
}

export function renderDiagram({
  ctx,
  width,
  height,
  layout,
  definition,
  colors,
  state,
}: RenderOptions): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, width, height);

  if (definition.states.length === 0) return;

  const { bounds, positions, edges } = layout;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  // Fit the graph into the canvas, but never magnify past 1:1 or a two-state
  // machine would render as two enormous circles.
  const scale = Math.min(
    (width - PADDING * 2) / Math.max(spanX, 1),
    (height - PADDING * 2) / Math.max(spanY, 1),
    1
  );
  const offsetX = (width - spanX * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - spanY * scale) / 2 - bounds.minY * scale;
  const toScreen = (p: Point): Point => ({
    x: p.x * scale + offsetX,
    y: p.y * scale + offsetY,
  });

  const radius = Math.max(18, BASE_RADIUS * scale);
  const fontSize = Math.max(9, Math.round(11 * Math.max(scale, 0.75)));

  // Edges first so nodes sit on top of them.
  for (const edge of edges) {
    const fromPoint = positions[edge.from];
    const toPoint = positions[edge.to];
    if (!fromPoint || !toPoint) continue;

    const isActive = edge.transitions.some(t => state.activeTransitions.has(t.id));
    const stroke = isActive ? colors.accent : colors.text2;
    const labelColor = isActive ? colors.accent : colors.text;
    const lines = edge.transitions.map(formatTransitionLabel);

    ctx.lineWidth = isActive ? 2.4 : 1.4;
    ctx.strokeStyle = stroke;

    if (edge.selfLoop) {
      const centre = toScreen(fromPoint);
      const loopHeight = radius * 2.1;
      const left = centre.x - radius * 0.62;
      const right = centre.x + radius * 0.62;
      const topY = centre.y - radius * 0.82;
      const controlY = centre.y - radius - loopHeight;

      ctx.beginPath();
      ctx.moveTo(left, topY);
      ctx.bezierCurveTo(left - radius, controlY, right + radius, controlY, right, topY);
      ctx.stroke();

      drawArrowHead(ctx, right, topY, Math.PI / 2.2, stroke, 8 + scale * 2);
      drawLabels(
        ctx,
        lines,
        centre.x,
        controlY + loopHeight * 0.12,
        labelColor,
        colors,
        fontSize
      );
      continue;
    }

    const from = toScreen(fromPoint);
    const to = toScreen(toPoint);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    // Perpendicular offset, so a bidirectional pair bows to opposite sides.
    const perpX = -((to.y - from.y) / dist);
    const perpY = (to.x - from.x) / dist;
    const bow = edge.bow * scale;
    const apexX = midX + perpX * bow;
    const apexY = midY + perpY * bow;
    // Control point chosen so the quadratic passes through the apex at t=0.5.
    const controlX = 2 * apexX - midX;
    const controlY = 2 * apexY - midY;

    const startAngle = Math.atan2(controlY - from.y, controlX - from.x);
    const endAngle = Math.atan2(to.y - controlY, to.x - controlX);
    const startX = from.x + Math.cos(startAngle) * radius;
    const startY = from.y + Math.sin(startAngle) * radius;
    const endX = to.x - Math.cos(endAngle) * (radius + 4);
    const endY = to.y - Math.sin(endAngle) * (radius + 4);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();

    drawArrowHead(ctx, endX, endY, endAngle, stroke, 9 + scale * 2);
    // Nudge the label clear of the curve it belongs to.
    drawLabels(
      ctx,
      lines,
      apexX + perpX * 12,
      apexY + perpY * 12 - (bow === 0 ? 12 : 0),
      labelColor,
      colors,
      fontSize
    );
  }

  drawNodes(ctx, definition, layout, toScreen, radius, colors, state, scale);
}
