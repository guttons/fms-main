import React from 'react';

interface PredictiveBackWrapperProps {
  activeView: string;
  setActiveView: (view: string) => void;
  renderContent: (viewToRender?: string) => React.ReactNode;
  children?: React.ReactNode;
}

/**
 * PredictiveBackWrapper:
 * Pass-through wrapper for main view content.
 * Allows native Android (Predictive Back) and iOS (Swipe Back) gestures to handle
 * smooth back navigation without DOM offset artifacts or layer clipping issues.
 */
export const PredictiveBackWrapper: React.FC<PredictiveBackWrapperProps> = ({
  activeView,
  renderContent,
  children,
}) => {
  return (
    <div className={`w-full ${activeView === 'tracker' ? 'flex-1 h-full min-h-0 flex flex-col overflow-hidden' : 'min-h-full'}`}>
      {children || renderContent(activeView)}
    </div>
  );
};
