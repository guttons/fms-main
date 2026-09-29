import React, { useEffect, useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { haptic } from '../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Ultra-smooth, GPU-accelerated native-style bottom sheet.
 * Features:
 * - Fluid iOS/Material decelerated spring slide-up and slide-down transitions (350ms cubic-bezier(0.32, 0.72, 0, 1))
 * - Double-RAF + forced layout reflow guarantees zero-pop slide-in animation every time
 * - Hardware accelerated translate3d transforms (transform-gpu, will-change-transform)
 * - Cohesive backdrop blur & opacity fade
 * - Touch drag tracking with velocity detection and smooth snap-back
 * - Keyboard (Escape) & close button dismiss
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
  const dragStartTime = useRef<number>(0);

  // Mount/Unmount lifecycle with double-RAF layout reflow to guarantee smooth slide-up
  useEffect(() => {
    let unmountTimer: ReturnType<typeof setTimeout> | undefined;
    let raf1: number | undefined;
    let raf2: number | undefined;

    if (isOpen) {
      setIsRendered(true);
      // Double RAF + layout reflow ensures the DOM commits the off-screen translate-y-full before animating
      raf1 = requestAnimationFrame(() => {
        if (sheetRef.current) {
          // Force layout reflow
          void sheetRef.current.offsetHeight;
        }
        raf2 = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Allow full 320ms transition before removing from DOM so slide-down never gets cut off
      unmountTimer = setTimeout(() => {
        setIsRendered(false);
      }, 340);
    }

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
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

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Touch drag handlers with zero-lag requestAnimationFrame throttling and spring physics
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragStartTime.current = Date.now();
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
        sheetRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    const deltaY = currentTranslateY.current;
    const sheetHeight = sheetRef.current?.offsetHeight || 380;
    const timeElapsed = Math.max(Date.now() - dragStartTime.current, 1);
    const velocity = deltaY / timeElapsed; // in px/ms

    // Dismiss if swiped past 30% height OR flicked downward quickly (>0.3 px/ms)
    const shouldDismiss = deltaY > sheetHeight * 0.3 || velocity > 0.3;

    if (shouldDismiss) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 250ms ease';
        sheetRef.current.style.transform = 'translate3d(0, 100%, 0)';
        sheetRef.current.style.opacity = '0';
      }
      haptic('TAP');
      setTimeout(() => {
        onClose();
        if (sheetRef.current) {
          sheetRef.current.style.transition = '';
          sheetRef.current.style.transform = '';
          sheetRef.current.style.opacity = '';
        }
        currentTranslateY.current = 0;
      }, 290);
    } else {
      // Smooth spring snap-back to fully expanded state
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
        sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      setTimeout(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transition = '';
        }
        currentTranslateY.current = 0;
      }, 330);
    }
  }, [onClose]);

  if (!isRendered) return null;

  return (
    <>
      {/* Backdrop with lightweight GPU opacity transition */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[70] transition-[opacity,backdrop-filter] duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] transform-gpu will-change-[opacity,backdrop-filter] ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          haptic('TAP');
          onClose();
        }}
      />

      {/* Floating Sheet Container (GPU Composited) */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-[71] bg-surface border-t border-slate-300/40 dark:border-[rgba(255,255,255,0.08)] rounded-t-[28px] shadow-[0_-12px_48px_rgba(0,0,0,0.45)] transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] transform-gpu will-change-transform ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-90'
        }`}
        style={{
          maxHeight: '82vh',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Glow Top Accent Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary/40 rounded-full" />

        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing group">
          <div className="w-10 h-1.5 rounded-full bg-on-surface/20 group-hover:bg-primary/50 transition-colors duration-200" />
        </div>

        {/* Header Title with Close Button */}
        {title && (
          <div className="px-5 pb-2.5 pt-0.5 border-b border-slate-300/40 dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h3 className="text-[11px] font-black text-on-surface/80 uppercase tracking-widest">
              {title}
            </h3>
            <button
              onClick={() => {
                haptic('TAP');
                onClose();
              }}
              className="p-1 -mr-1 rounded-full text-on-surface-dim hover:text-on-surface hover:bg-surface-dim active:scale-95 transition-all duration-150"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Container */}
        <div
          className="overflow-y-auto custom-scrollbar px-2 py-1 overscroll-contain"
          style={{ 
            maxHeight: 'calc(82vh - 65px)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

// ── Sheet Section Header ──────────────────────────────────────────────────────
export const SheetSectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 pt-3 pb-1 text-[10px] font-black text-primary/80 uppercase tracking-wider">
    {title}
  </div>
);

// ── Bottom Sheet Action Item ──────────────────────────────────────────────────
export interface SheetActionProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  badge?: number;
  trailing?: React.ReactNode;
  isActive?: boolean;
}

export const SheetAction: React.FC<SheetActionProps> = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  badge,
  trailing,
  isActive = false,
}) => (
  <button
    onClick={() => {
      haptic('TAP');
      onClick();
    }}
    className={`flex items-center w-full px-4 py-2.5 text-left transition-all duration-150 active:scale-[0.98] rounded-xl ${
      variant === 'danger'
        ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/20'
        : isActive
        ? 'bg-primary/12 text-primary font-bold shadow-sm'
        : 'text-on-surface hover:bg-primary/8 active:bg-primary/12'
    }`}
  >
    <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
      variant === 'danger' 
        ? 'bg-red-500/10 text-red-400' 
        : isActive 
        ? 'bg-primary/15 text-primary ring-1 ring-primary/30' 
        : 'bg-surface-dim/60 text-on-surface/75'
    }`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
    </div>
    <span className={`flex-1 text-xs tracking-tight ${isActive ? 'font-black text-primary' : 'font-semibold'}`}>
      {label}
    </span>
    {isActive && (
      <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-glow mr-1" />
    )}
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 bg-primary text-white dark:text-slate-900 text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-4 text-center shadow-sm">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
    {trailing}
  </button>
);

// ── Sheet Divider ─────────────────────────────────────────────────────────────
export const SheetDivider: React.FC = () => (
  <div className="h-px bg-slate-300/40 dark:bg-[rgba(255,255,255,0.06)] mx-4 my-1.5" />
);
