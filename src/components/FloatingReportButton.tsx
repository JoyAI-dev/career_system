'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ClipboardList } from 'lucide-react';

const STORAGE_KEY = 'floating-report-btn-pos';
const DEFAULT_BOTTOM = 24;
const DEFAULT_RIGHT = 24;

interface Props {
  currentStage: string | null;
}

function loadPosition(): { bottom: number; right: number } {
  if (typeof window === 'undefined') return { bottom: DEFAULT_BOTTOM, right: DEFAULT_RIGHT };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { bottom: parsed.bottom ?? DEFAULT_BOTTOM, right: parsed.right ?? DEFAULT_RIGHT };
    }
  } catch {}
  return { bottom: DEFAULT_BOTTOM, right: DEFAULT_RIGHT };
}

function savePosition(bottom: number, right: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bottom, right }));
  } catch {}
}

export function FloatingReportButton({ currentStage }: Props) {
  const t = useTranslations('dashboard');
  const [pos, setPos] = useState({ bottom: DEFAULT_BOTTOM, right: DEFAULT_RIGHT });
  const [mounted, setMounted] = useState(false);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const startPos = useRef({ bottom: 0, right: 0 });

  useEffect(() => {
    setPos(loadPosition());
    setMounted(true);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    startPoint.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true;
    }
    const newRight = Math.max(0, Math.min(window.innerWidth - 60, startPos.current.right - dx));
    const newBottom = Math.max(0, Math.min(window.innerHeight - 60, startPos.current.bottom + dy));
    setPos({ bottom: newBottom, right: newRight });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      savePosition(pos.bottom, pos.right);
    }
  }, [pos]);

  if (!mounted) return null;

  const label = currentStage
    ? t('floatingReportStage', { stage: currentStage })
    : t('floatingReport');

  return (
    <Link
      href="/cognitive-report"
      onClick={(e) => {
        if (hasMoved.current) {
          e.preventDefault();
        }
      }}
      className="fixed z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-shadow hover:shadow-xl active:shadow-md select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ bottom: pos.bottom, right: pos.right }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <ClipboardList className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline max-w-[160px] truncate">{label}</span>
      <span className="sm:hidden sr-only">{label}</span>
    </Link>
  );
}
