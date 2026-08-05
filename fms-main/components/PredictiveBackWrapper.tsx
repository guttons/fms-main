import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [viewHistory, setViewHistory] = useState<string[]>([activeView]);
  const viewHistoryRef = useRef<string[]>([activeView]);
  
  // Track navigation stack history
  useEffect(() => {
    const history = viewHistoryRef.current;
    if (history[history.length - 1] !== activeView) {
      // Check if user went back or forward
      const existingIdx = history.lastIndexOf(activeView);
      if (existingIdx !== -1 && existingIdx === history.length - 2) {
        // User popped back
        history.pop();
      } else {
        // Forward navigation
        history.push(activeView);
      }
      setViewHistory([...history]);
    }
  }, [activeView]);

  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [previousView, setPreviousView] = useState<string | null>(null);

  const startXRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isGestureActiveRef = useRef<boolean>(false);
  const activeContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only allow swipe from left edge (0px to 28px) on mobile
    const touch = e.touches[0];
    if (touch.clientX > 28) return;

    const history = viewHistoryRef.current;
    if (history.length < 2) return;

    const prevView = history[history.length - 2];
    if (!prevView || prevView === activeView) return;

    isGestureActiveRef.current = true;
    startXRef.current = touch.clientX;
    startTimeRef.current = Date.now();
    setPreviousView(prevView);
    setIsSwiping(true);
    setSwipeProgress(0);
    setDragDeltaX(0);

    if (activeContainerRef.current) {
      activeContainerRef.current.style.transition = 'none';
    }
    if (previewContainerRef.current) {
      previewContainerRef.current.style.transition = 'none';
    }
  }, [activeView]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isGestureActiveRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;

    if (deltaX > 0) {
      const screenWidth = window.innerWidth || 390;
      const progress = Math.min(deltaX / (screenWidth * 0.85), 1);
      
      setDragDeltaX(deltaX);
      setSwipeProgress(progress);

      // Active view slides right, scales down slightly, gets rounded corners
      if (activeContainerRef.current) {
        const scale = 1 - progress * 0.05;
        const borderRadius = Math.min(progress * 24, 24);
        activeContainerRef.current.style.transform = `translate3d(${deltaX}px, 0, 0) scale(${scale})`;
        activeContainerRef.current.style.borderRadius = `${borderRadius}px`;
        activeContainerRef.current.style.boxShadow = `-16px 0 40px rgba(0, 0, 0, ${0.35 * (1 - progress)})`;
      }

      // Preview view behind slides in from left (-30% -> 0%) with subtle scale
      if (previewContainerRef.current) {
        const previewTranslate = -30 + progress * 30;
        const previewScale = 0.95 + progress * 0.05;
        previewContainerRef.current.style.transform = `translate3d(${previewTranslate}%, 0, 0) scale(${previewScale})`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isGestureActiveRef.current) return;
    isGestureActiveRef.current = false;

    const screenWidth = window.innerWidth || 390;
    const deltaX = dragDeltaX;
    const progress = swipeProgress;
    const timeElapsed = Math.max(Date.now() - startTimeRef.current, 1);
    const velocity = deltaX / timeElapsed; // px/ms

    // Threshold: > 35% drag distance OR fast rightward flick (>0.35 px/ms)
    const shouldNavigateBack = progress > 0.35 || velocity > 0.35;

    if (activeContainerRef.current) {
      activeContainerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease, box-shadow 0.25s ease';
    }
    if (previewContainerRef.current) {
      previewContainerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    if (shouldNavigateBack && previousView) {
      // Complete back gesture: animate active view off-screen to right
      if (activeContainerRef.current) {
        activeContainerRef.current.style.transform = `translate3d(${screenWidth}px, 0, 0) scale(0.95)`;
      }
      if (previewContainerRef.current) {
        previewContainerRef.current.style.transform = 'translate3d(0%, 0, 0) scale(1)';
      }
      
      haptic('SELECTION');

      setTimeout(() => {
        const targetView = previousView;
        setIsSwiping(false);
        setPreviousView(null);
        setDragDeltaX(0);
        setSwipeProgress(0);

        if (activeContainerRef.current) {
          activeContainerRef.current.style.transition = '';
          activeContainerRef.current.style.transform = '';
          activeContainerRef.current.style.borderRadius = '';
          activeContainerRef.current.style.boxShadow = '';
        }

        // Pop history and navigate to previous view
        viewHistoryRef.current.pop();
        setViewHistory([...viewHistoryRef.current]);
        setActiveView(targetView);
      }, 220);
    } else {
      // Revert gesture: spring snap back to 0px (same page)
      if (activeContainerRef.current) {
        activeContainerRef.current.style.transform = 'translate3d(0px, 0, 0) scale(1)';
        activeContainerRef.current.style.borderRadius = '0px';
        activeContainerRef.current.style.boxShadow = 'none';
      }
      if (previewContainerRef.current) {
        previewContainerRef.current.style.transform = 'translate3d(-30%, 0, 0) scale(0.95)';
      }

      setTimeout(() => {
        setIsSwiping(false);
        setPreviousView(null);
        setDragDeltaX(0);
        setSwipeProgress(0);

        if (activeContainerRef.current) {
          activeContainerRef.current.style.transition = '';
          activeContainerRef.current.style.transform = '';
          activeContainerRef.current.style.borderRadius = '';
          activeContainerRef.current.style.boxShadow = '';
        }
      }, 250);
    }
  }, [dragDeltaX, swipeProgress, previousView, setActiveView]);

  return (
    <div 
      className={`relative w-full min-h-full touch-pan-y ${isSwiping ? 'overflow-hidden' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Returning Previous View Preview Layer */}
      {isSwiping && previousView && (
        <div 
          ref={previewContainerRef}
          className="absolute inset-0 z-0 overflow-y-auto pointer-events-none transform-gpu will-change-transform bg-surface"
          style={{
            transform: 'translate3d(-30%, 0, 0) scale(0.95)',
          }}
        >
          {renderContent(previousView)}
          {/* Dimming Overlay */}
          <div 
            className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-75"
            style={{ opacity: 0.35 * (1 - swipeProgress) }}
          />
        </div>
      )}

      {/* Active Current View Layer */}
      <div 
        ref={activeContainerRef}
        className="relative z-10 w-full min-h-full transform-gpu will-change-transform bg-surface"
      >
        {children || renderContent(activeView)}
      </div>
    </div>
  );
};
