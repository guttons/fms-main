import React, { useEffect, useRef, useCallback } from 'react';
import { haptic } from '../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * A native-style bottom sheet that slides up from the screen bottom.
 * Features:
 * - Spring slide-up/down animation
 * - Draggable handle bar for dismiss gesture
 * - Touch-based drag: drag down > 100px = auto-dismiss
 * - Dark backdrop with blur
 * - Haptic feedback on open/close
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const currentTranslateY = useRef<number>(0);
  const isDragging = useRef(false);
  const wasOpenRef = useRef(false);

  // Fire haptic on open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      haptic('TAP');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Drag handlers
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
    // Only allow dragging downward
    if (deltaY > 0) {
      currentTranslateY.current = deltaY;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
    }
    // If dragged more than 100px, dismiss
    if (currentTranslateY.current > 100) {
      haptic('TAP');
      onClose();
    } else {
      // Snap back
      if (sheetRef.current) {
        sheetRef.current.style.transform = '';
      }
    }
    currentTranslateY.current = 0;
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] transition-opacity duration-300"
        onClick={() => {
          haptic('TAP');
          onClose();
        }}
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-[71] bg-surface border-t border-outline/30 rounded-t-[20px] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          maxHeight: '70vh',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-on-surface/20" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-5 pb-3 border-b border-outline/20">
            <h3 className="text-sm font-semibold text-on-surface/70 uppercase tracking-wider">
              {title}
            </h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {children}
        </div>
      </div>
    </>
  );
};

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
    className={`flex items-center w-full px-5 py-3.5 text-left transition-colors duration-200 active:scale-[0.98] ${
      variant === 'danger'
        ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/20'
        : 'text-on-surface hover:bg-primary/5 active:bg-primary/10'
    }`}
  >
    <Icon className="w-5 h-5 mr-4 flex-shrink-0 opacity-70" />
    <span className="flex-1 text-sm font-medium">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 bg-primary text-on-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
    {trailing}
  </button>
);

// ── Sheet Divider ─────────────────────────────────────────────────────────────
export const SheetDivider: React.FC = () => (
  <div className="h-px bg-outline/15 mx-5 my-1" />
);
