import React, { useRef, useEffect, useCallback } from 'react';
import { haptic } from '../utils/haptics';

interface PredictiveBackWrapperProps {
  activeView: string;
  setActiveView: (view: string) => void;
  renderContent: (viewToRender?: string) => React.ReactNode;
  children?: React.ReactNode;
}

export const PredictiveBackWrapper: React.FC<PredictiveBackWrapperProps> = ({
  activeView,
  setActiveView,
  renderContent,
  children,
}) => {
  // Navigation history stack (ref-only, no state re-renders)
  const viewHistoryRef = useRef<string[]>([activeView]);

  useEffect(() => {
    const history = viewHistoryRef.current;
    if (history[history.length - 1] !== activeView) {
      const prevIdx = history.lastIndexOf(activeView);
      if (prevIdx !== -1 && prevIdx === history.length - 2) {
        history.pop();
      } else {
        history.push(activeView);
      }
    }
  }, [activeView]);

  // All gesture state lives in refs to avoid re-renders during drag
  const isGestureActiveRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const currentDeltaRef = useRef(0);
  const previousViewRef = useRef<string | null>(null);
  const swipeEdgeRef = useRef<'left' | 'right' | null>(null);

  const activeContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const EDGE_ZONE = 24; // px from edge to initiate gesture
  const LOCK_THRESHOLD = 8; // px of movement before locking direction

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const screenWidth = window.innerWidth || 390;

    // Check if touch started in left or right edge zone
    const isLeftEdge = touch.clientX <= EDGE_ZONE;
    const isRightEdge = touch.clientX >= screenWidth - EDGE_ZONE;

    if (!isLeftEdge && !isRightEdge) return;

    const history = viewHistoryRef.current;
    if (history.length < 2) return;

    const prevView = history[history.length - 2];
    if (!prevView || prevView === activeView) return;

    // Mark gesture as potential (not yet locked)
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    startTimeRef.current = Date.now();
    directionLockedRef.current = null;
    currentDeltaRef.current = 0;
    previousViewRef.current = prevView;
    swipeEdgeRef.current = isLeftEdge ? 'left' : 'right';
  }, [activeView]);

  const activateGesture = useCallback(() => {
    isGestureActiveRef.current = true;

    // Show preview layer & overlay
    if (previewContainerRef.current) {
      previewContainerRef.current.style.display = 'block';
      previewContainerRef.current.style.transition = 'none';
      previewContainerRef.current.style.transform = 'translate3d(-25%, 0, 0)';
      previewContainerRef.current.style.opacity = '1';
    }
    if (overlayRef.current) {
      overlayRef.current.style.display = 'block';
      overlayRef.current.style.transition = 'none';
    }
    if (activeContainerRef.current) {
      activeContainerRef.current.style.transition = 'none';
    }
    // Lock body scroll during horizontal gesture
    if (wrapperRef.current) {
      wrapperRef.current.style.overflow = 'hidden';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (swipeEdgeRef.current === null) return;

    const touch = e.touches[0];
    const rawDeltaX = touch.clientX - startXRef.current;
    const rawDeltaY = touch.clientY - startYRef.current;

    // Direction lock: determine if this is a horizontal or vertical gesture
    if (directionLockedRef.current === null) {
      const absX = Math.abs(rawDeltaX);
      const absY = Math.abs(rawDeltaY);
      if (absX < LOCK_THRESHOLD && absY < LOCK_THRESHOLD) return;

      if (absY > absX * 1.2) {
        // Vertical scroll — abort gesture entirely
        directionLockedRef.current = 'vertical';
        swipeEdgeRef.current = null;
        return;
      }
      directionLockedRef.current = 'horizontal';
      activateGesture();
    }

    if (directionLockedRef.current !== 'horizontal' || !isGestureActiveRef.current) return;

    // Compute effective delta (only positive = swiping inward from edge)
    const effectiveDelta = swipeEdgeRef.current === 'left'
      ? Math.max(0, rawDeltaX)
      : Math.max(0, -rawDeltaX);

    currentDeltaRef.current = effectiveDelta;
    const screenWidth = window.innerWidth || 390;
    const progress = Math.min(effectiveDelta / screenWidth, 1);

    // Move active view: simple translateX
    if (activeContainerRef.current) {
      const translateX = swipeEdgeRef.current === 'left' ? effectiveDelta : -effectiveDelta;
      activeContainerRef.current.style.transform = `translate3d(${translateX}px, 0, 0)`;
    }

    // Move preview: from -25% toward 0%
    if (previewContainerRef.current) {
      const previewTranslate = -25 + progress * 25;
      previewContainerRef.current.style.transform = `translate3d(${previewTranslate}%, 0, 0)`;
    }

    // Dim overlay fades as you swipe
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(0.3 * (1 - progress));
    }
  }, [activateGesture]);

  const resetGesture = useCallback(() => {
    isGestureActiveRef.current = false;
    directionLockedRef.current = null;
    currentDeltaRef.current = 0;
    previousViewRef.current = null;
    swipeEdgeRef.current = null;

    if (activeContainerRef.current) {
      activeContainerRef.current.style.transition = '';
      activeContainerRef.current.style.transform = '';
    }
    if (previewContainerRef.current) {
      previewContainerRef.current.style.transition = '';
      previewContainerRef.current.style.transform = '';
      previewContainerRef.current.style.display = 'none';
    }
    if (overlayRef.current) {
      overlayRef.current.style.transition = '';
      overlayRef.current.style.opacity = '';
      overlayRef.current.style.display = 'none';
    }
    if (wrapperRef.current) {
      wrapperRef.current.style.overflow = '';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isGestureActiveRef.current) {
      // Gesture never activated (was vertical or too small)
      swipeEdgeRef.current = null;
      directionLockedRef.current = null;
      return;
    }

    const screenWidth = window.innerWidth || 390;
    const delta = currentDeltaRef.current;
    const timeElapsed = Math.max(Date.now() - startTimeRef.current, 1);
    const velocity = delta / timeElapsed;
    const progress = delta / screenWidth;

    const shouldNavigateBack = progress > 0.3 || velocity > 0.4;
    const edge = swipeEdgeRef.current;
    const targetView = previousViewRef.current;

    const TRANSITION = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';
    const OVERLAY_TRANSITION = 'opacity 0.22s ease';

    if (shouldNavigateBack && targetView) {
      // Complete: slide active view fully off-screen
      if (activeContainerRef.current) {
        activeContainerRef.current.style.transition = TRANSITION;
        const dir = edge === 'left' ? screenWidth : -screenWidth;
        activeContainerRef.current.style.transform = `translate3d(${dir}px, 0, 0)`;
      }
      if (previewContainerRef.current) {
        previewContainerRef.current.style.transition = TRANSITION;
        previewContainerRef.current.style.transform = 'translate3d(0%, 0, 0)';
      }
      if (overlayRef.current) {
        overlayRef.current.style.transition = OVERLAY_TRANSITION;
        overlayRef.current.style.opacity = '0';
      }

      haptic('SELECTION');

      setTimeout(() => {
        viewHistoryRef.current.pop();
        resetGesture();
        setActiveView(targetView);
      }, 200);
    } else {
      // Revert: snap everything back
      if (activeContainerRef.current) {
        activeContainerRef.current.style.transition = TRANSITION;
        activeContainerRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      if (previewContainerRef.current) {
        previewContainerRef.current.style.transition = TRANSITION;
        previewContainerRef.current.style.transform = 'translate3d(-25%, 0, 0)';
      }
      if (overlayRef.current) {
        overlayRef.current.style.transition = OVERLAY_TRANSITION;
        overlayRef.current.style.opacity = '0.3';
      }

      setTimeout(() => {
        resetGesture();
      }, 220);
    }
  }, [setActiveView, resetGesture]);

  // Memoize previous view content to avoid re-rendering during drag
  const prevViewContent = previousViewRef.current ? renderContent(previousViewRef.current) : null;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full min-h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Previous view preview (hidden by default, shown during gesture) */}
      <div
        ref={previewContainerRef}
        className="absolute inset-0 z-0 overflow-hidden transform-gpu will-change-transform bg-surface"
        style={{ display: 'none', transform: 'translate3d(-25%, 0, 0)' }}
      >
        {prevViewContent}
      </div>

      {/* Dimming overlay between layers */}
      <div
        ref={overlayRef}
        className="absolute inset-0 z-[1] bg-black pointer-events-none"
        style={{ display: 'none', opacity: 0.3 }}
      />

      {/* Active view */}
      <div
        ref={activeContainerRef}
        className="relative z-[2] w-full min-h-full transform-gpu will-change-transform bg-surface"
      >
        {children || renderContent(activeView)}
      </div>
    </div>
  );
};
