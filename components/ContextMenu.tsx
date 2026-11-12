'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export interface CtxAction {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
}

/** A macOS-style context menu for the Finder's files and cases:
 *  long-press on touch, right-click or the "…" button with a
 *  mouse. Nothing happens until an item is chosen; the backdrop,
 *  a second tap, or Escape closes it without doing anything. */
export default function ContextMenu({
  actions,
  children,
  className,
  menuLabel,
}: {
  actions: CtxAction[];
  children: ReactNode;
  className?: string;
  menuLabel?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const open = (x: number, y: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = actions.length * 40 + 18;
    setPos({
      x: Math.min(Math.max(8, x), Math.max(8, vw - 226)),
      y: Math.min(Math.max(8, y), Math.max(8, vh - h - 8)),
    });
  };
  const close = () => setPos(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos !== null]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    cancel();
    timer.current = setTimeout(() => {
      startRef.current = null;
      open(e.clientX, e.clientY);
    }, 450);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = startRef.current;
    if (s && (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10)) cancel();
  };

  return (
    <div
      className={`ctxwrap${className ? ` ${className}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerMove={onPointerMove}
      onPointerCancel={cancel}
      onContextMenu={(e) => { e.preventDefault(); open(e.clientX, e.clientY); }}
    >
      {children}
      <button
        type="button"
        className="ctxbtn"
        aria-label={menuLabel || 'Open menu'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          open(r.right - 200, r.bottom + 4);
        }}
      >
        <Icon name="dots" size={15} />
      </button>
      {pos && (
        <div className="ctxbackdrop" onClick={close}>
          <div
            className="ctxmenu"
            role="menu"
            style={{ left: pos.x, top: pos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                className={`ctxitem${a.danger ? ' danger' : ''}`}
                onClick={() => { close(); a.onSelect(); }}
              >
                {a.icon && <Icon name={a.icon} size={15} />}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
