import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

export interface XrayRevealProps {
  reveal: number;
  onRevealChange: (value: number) => void;
  beforeContent: ReactNode;
  afterContent: ReactNode;
}

const KEYBOARD_STEP = 5;

export function clampReveal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function XrayReveal({ reveal, onRevealChange, beforeContent, afterContent }: XrayRevealProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingClientXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const revealFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return reveal;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampReveal(ratio * 100);
  }, [reveal]);

  const flushPendingMove = useCallback(() => {
    rafRef.current = null;
    if (pendingClientXRef.current === null) return;
    const nextReveal = revealFromClientX(pendingClientXRef.current);
    pendingClientXRef.current = null;
    onRevealChange(nextReveal);
  }, [onRevealChange, revealFromClientX]);

  const schedulePendingMove = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingMove);
    }
  }, [flushPendingMove]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    schedulePendingMove(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    schedulePendingMove(event.clientX);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onRevealChange(clampReveal(reveal - KEYBOARD_STEP));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onRevealChange(clampReveal(reveal + KEYBOARD_STEP));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onRevealChange(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onRevealChange(100);
    }
  };

  return (
    <div
      ref={trackRef}
      className="xray-reveal"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="xray-reveal__before">{beforeContent}</div>
      <div className="xray-reveal__after" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
        {afterContent}
      </div>
      <div className="xray-reveal__line" style={{ left: `${reveal}%` }}>
        <button
          type="button"
          className="xray-reveal__handle"
          role="slider"
          aria-label="Reveal hidden value in the room"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(reveal)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
