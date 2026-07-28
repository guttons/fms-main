import React, { useEffect, useRef, useCallback, useState } from 'react';
import { haptic } from '../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * A sleek native-style bottom sheet component.
 * Features:
 * - Full entrance & exit animations (spring slide-up & slide-down + backdrop fade)
 * - Draggable top handle for drag-to-dismiss gesture
 * - Touch drag tracking with smooth snap-back or swipe-down exit
 * - Compact spacing and light borders
 * - Section headers for distinct grouping
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const currentTranslateY = useRef<number>(0);
  const isDragging = useRef(false);

  // Mount/Unmount lifecycle with smooth closing transition
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Haptic feedback on open
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      haptic('TAP');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isRendered) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRendered]);

  // Drag-to-dismiss touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    currentTranslateY.current = 0;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    if (deltaY > 0) {
      currentTranslateY.current = deltaY;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
    }

    if (currentTranslateY.current > 80) {
      haptic('TAP');
      onClose();
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transform = '';
      }
    }
    currentTranslateY.current = 0;
  }, [onClose]);

  if (!isRendered) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[70] transition-opacity duration-300 ease-out ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          haptic('TAP');
          onClose();
        }}
      />

      {/* Floating Sheet Container */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-[71] bg-surface border-t border-slate-300/50 dark:border-[rgba(255,255,255,0.08)] rounded-t-[24px] shadow-[0_-8px_40px_rgba(0,0,0,0.4)] transition-all duration-300 cubic-bezier(0.32,1.25,0.32,1) ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-90'
        }`}
        style={{
          maxHeight: '75vh',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Glow Top Accent Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary/30 rounded-full" />

        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing group">
          <div className="w-10 h-1 rounded-full bg-on-surface/15 group-hover:bg-primary/40 transition-colors duration-200" />
        </div>

        {/* Header Title (clean, no swipe text) */}
        {title && (
          <div className="px-5 pb-2.5 border-b border-slate-300/40 dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h3 className="text-[11px] font-black text-on-surface/80 uppercase tracking-widest">
              {title}
            </h3>
          </div>
        )}

        {/* Content Container */}
        <div
          className={`overflow-y-auto custom-scrollbar py-1 transition-all duration-300 ${
            isVisible ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''
          }`}
          style={{ maxHeight: 'calc(75vh - 60px)' }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

// ── Sheet Section Header ──────────────────────────────────────────────────────
export const SheetSectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-5 pt-2.5 pb-1 text-[10px] font-black text-primary/70 uppercase tracking-wider">
    {title}
  </div>
);

// ── Bottom Sheet Action Item ──────────────────────────────────────────────────
interface SheetActionProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  badge?: number;
  trailing?: React.ReactNode;
}

export const SheetAction: React.FC<SheetActionProps> = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  badge,
  trailing,
}) => (
  <button
    onClick={() => {
      haptic('TAP');
      onClick();
    }}
    className={`flex items-center w-full px-5 py-2.5 text-left transition-all duration-150 active:scale-[0.98] ${
      variant === 'danger'
        ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/20'
        : 'text-on-surface hover:bg-primary/8 active:bg-primary/12'
    }`}
  >
    <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
      variant === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-surface-dim/60 text-on-surface/75'
    }`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
    </div>
    <span className="flex-1 text-xs font-semibold tracking-tight">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 bg-primary text-on-primary text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-4 text-center shadow-sm">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
    {trailing}
  </button>
);

// ── Sheet Divider ─────────────────────────────────────────────────────────────
export const SheetDivider: React.FC = () => (
  <div className="h-px bg-slate-300/40 dark:bg-[rgba(255,255,255,0.06)] mx-5 my-1.5" />
);
