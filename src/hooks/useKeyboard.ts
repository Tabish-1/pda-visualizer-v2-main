'use client';

// Keyboard shortcuts for playback: Space, ←, →, R.

import { useEffect, useRef } from 'react';

interface KeyboardShortcuts {
  onTogglePlay?: () => void;
  onStepForward?: () => void;
  onStepBackward?: () => void;
  onReset?: () => void;
}

export function useKeyboard({
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onReset,
}: KeyboardShortcuts) {
  const handlersRef = useRef({ onTogglePlay, onStepForward, onStepBackward, onReset });

  // Kept in a ref so the listener below registers once instead of re-binding on
  // every render. Written in an effect rather than during render, since a render
  // can be discarded and must not mutate anything.
  useEffect(() => {
    handlersRef.current = { onTogglePlay, onStepForward, onStepBackward, onReset };
  }, [onTogglePlay, onStepForward, onStepBackward, onReset]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

      const handlers = handlersRef.current;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          handlers.onTogglePlay?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handlers.onStepForward?.();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlers.onStepBackward?.();
          break;
        case 'r':
        case 'R':
          handlers.onReset?.();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
