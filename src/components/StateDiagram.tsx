
// src/components/StateDiagram.tsx
// Canvas-based state diagram visualization

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Transition } from '../types/pda.types';

interface StateDiagramProps {
  states: string[];
  transitions: Transition[];
  currentState: string;
  startState: string;
  acceptStates: string[];
}

export const StateDiagram: React.FC<StateDiagramProps> = ({
  states,
  transitions,
  currentState,
  startState,
  acceptStates
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Calculate positions for states in a circle
  useEffect(() => {
    if (states.length === 0) return;

    const newPositions: Record<string, { x: number; y: number }> = {};
    const centerX = 400;
    const centerY = 250;
    const radius = 150;

    states.forEach((state, index) => {
      const angle = (2 * Math.PI * index) / states.length - Math.PI / 2;
      newPositions[state] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    setPositions(newPositions);
  }, [states]);

  // Draw the diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw transitions (arrows)
    transitions.forEach(t => {
      const from = positions[t.from];
      const to = positions[t.to];
      if (!from || !to) return;

      ctx.beginPath();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;

      if (t.from === t.to) {
        // Self-loop
        ctx.arc(from.x, from.y - 40, 20, 0, 2 * Math.PI);
      } else {
        // Regular arrow
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
      }
      ctx.stroke();

      // Draw arrowhead
      if (t.from !== t.to) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowX = to.x - 30 * Math.cos(angle);
        const arrowY = to.y - 30 * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - 10 * Math.cos(angle - Math.PI / 6),
          arrowY - 10 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - 10 * Math.cos(angle + Math.PI / 6),
          arrowY - 10 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#999';
        ctx.fill();
      }

      // Draw transition label
      const midX = t.from === t.to ? from.x : (from.x + to.x) / 2;
      const midY = t.from === t.to ? from.y - 65 : (from.y + to.y) / 2;
      
      ctx.fillStyle = '#000';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      const label = `${t.read || 'ε'},${t.pop || 'ε'}→${t.push || 'ε'}`;
      ctx.fillText(label, midX, midY - 5);
    });

    // Draw states (circles)
    states.forEach(state => {
      const pos = positions[state];
      if (!pos) return;

      // Main circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
      ctx.fillStyle = state === currentState ? '#4CAF50' : '#2196F3';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Double circle for accept states
      if (acceptStates.includes(state)) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Start state arrow
      if (state === startState) {
        ctx.beginPath();
        ctx.moveTo(pos.x - 50, pos.y);
        ctx.lineTo(pos.x - 35, pos.y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(pos.x - 35, pos.y);
        ctx.lineTo(pos.x - 40, pos.y - 5);
        ctx.lineTo(pos.x - 40, pos.y + 5);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
      }

      // State label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state, pos.x, pos.y);
    });
  }, [positions, states, transitions, currentState, acceptStates, startState]);

  return (
    <div className="border rounded-lg bg-white shadow-sm p-4">
      <h3 className="font-semibold mb-2 text-lg text-center">State Diagram</h3>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={500} 
        className="w-full border rounded"
      />
    </div>
  );
};

