import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X, AlertOctagon, Download, BellRing } from 'lucide-react';
import { sendNativeNotification } from '../utils/pwa';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'critical';

interface NotificationAction {
  label: string;
  onClick: () => void;
}

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  action?: NotificationAction;
  /** Duration in ms before auto-dismiss. Defaults to 5000. Pass 0 to persist until closed. */
  duration?: number;
}

interface NotificationPayload {
  message?: string;
  title?: string;
  type?: NotificationType;
}

interface NotificationContextType {
  notify: (messageOrPayload: string | NotificationPayload, type?: NotificationType) => void;
  notifyWithAction: (message: string, type: NotificationType, action: NotificationAction, duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((notif: Notification) => {
    setNotifications((prev) => {
      const newNotifs = [...prev, notif];
      // Limit queue to 5 pending notifications
      return newNotifs.length > 5 ? newNotifs.slice(newNotifs.length - 5) : newNotifs;
    });
  }, []);

  const notify = useCallback((messageOrPayload: string | NotificationPayload, type: NotificationType = 'info') => {
    let finalMessage = '';
    let finalType: NotificationType = type;

    if (typeof messageOrPayload === 'object' && messageOrPayload !== null) {
      finalMessage = messageOrPayload.message || messageOrPayload.title || '';
      if (messageOrPayload.type && ['success', 'error', 'warning', 'info', 'critical'].includes(messageOrPayload.type)) {
        finalType = messageOrPayload.type;
      }
    } else {
      finalMessage = String(messageOrPayload ?? '');
    }

    // Auto-detect High Alerts from message content for unmistakable visual hierarchy
    const msgLower = finalMessage.toLowerCase();
    if (
      msgLower.includes('high alert') ||
      msgLower.includes('request fueling') ||
      msgLower.includes('no fuel required') ||
      msgLower.includes('no-uplift') ||
      msgLower.includes('critical')
    ) {
      finalType = 'critical';
    }

    const id = Math.random().toString(36).substring(2, 9);
    addNotification({ id, message: finalMessage, type: finalType });
    if (document.visibilityState === 'hidden') {
      sendNativeNotification(`FMS ${finalType.toUpperCase()}`, finalMessage);
    }
  }, [addNotification]);

  const notifyWithAction = useCallback((
    message: string,
    type: NotificationType,
    action: NotificationAction,
    duration = 0
  ): string => {
    const id = Math.random().toString(36).substring(2, 9);
    addNotification({ id, message, type, action, duration });
    if (document.visibilityState === 'hidden') {
      sendNativeNotification(`FMS ${type.toUpperCase()}`, message);
    }
    return id;
  }, [addNotification]);

  const dismiss = useCallback((id: string) => {
    removeNotification(id);
  }, [removeNotification]);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, notifyWithAction, dismiss, clear }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[1000000] flex flex-col gap-2.5 pointer-events-none max-w-md w-auto sm:w-[400px]">
        {notifications.slice(0, 3).map((n) => (
          <Toast 
            key={n.id} 
            notification={n} 
            onClose={() => removeNotification(n.id)} 
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

const Toast: React.FC<{ notification: Notification; onClose: () => void }> = ({ notification, onClose }) => {
  const { type, message, action } = notification;
  const [isDismissing, setIsDismissing] = useState(false);
  const dur = notification.duration !== undefined ? notification.duration : 5000;

  useEffect(() => {
    if (dur > 0) {
      const timer = setTimeout(() => {
        setIsDismissing(true);
        setTimeout(onClose, 300); // Wait for transition out to finish
      }, dur);
      return () => clearTimeout(timer);
    }
  }, [notification.id, dur, onClose]);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(onClose, 300);
  };

  const config = {
    critical: {
      icon: <BellRing className="w-5 h-5 text-red-400 animate-bounce" />,
      containerClasses: 'bg-gradient-to-r from-red-950/95 via-rose-950/90 to-slate-950/95 text-white border-red-500/40 border-l-[6px] border-l-red-500 shadow-2xl',
      iconClasses: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
      labelColor: 'text-red-400',
      badgeBg: 'bg-red-500/25 border-red-500/40 text-red-300',
      progressBar: 'bg-gradient-to-r from-red-500 via-rose-400 to-amber-400',
      label: 'HIGH ALERT',
      isCritical: true,
    },
    error: {
      icon: <AlertOctagon className="w-5 h-5 text-rose-400" />,
      containerClasses: 'bg-gradient-to-r from-rose-950/95 via-slate-900/95 to-slate-950/95 text-white border-rose-500/30 border-l-[6px] border-l-rose-500 shadow-2xl',
      iconClasses: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
      labelColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
      progressBar: 'bg-rose-500',
      label: 'SYSTEM ERROR',
      isCritical: false,
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      containerClasses: 'bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-slate-950/95 text-white border-amber-500/30 border-l-[6px] border-l-amber-500 shadow-2xl',
      iconClasses: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
      labelColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      progressBar: 'bg-amber-500',
      label: 'WARNING',
      isCritical: false,
    },
    success: {
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      containerClasses: 'bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-slate-950/95 text-white border-emerald-500/30 border-l-[6px] border-l-emerald-500 shadow-2xl',
      iconClasses: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
      labelColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      progressBar: 'bg-emerald-500',
      label: 'SUCCESS',
      isCritical: false,
    },
    info: {
      icon: <Info className="w-5 h-5 text-sky-400" />,
      containerClasses: 'bg-gradient-to-r from-sky-950/95 via-slate-900/95 to-slate-950/95 text-white border-sky-500/30 border-l-[6px] border-l-sky-500 shadow-2xl',
      iconClasses: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
      labelColor: 'text-sky-400',
      badgeBg: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
      progressBar: 'bg-sky-500',
      label: 'INFORMATION',
      isCritical: false,
    }
  }[type];

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden flex items-stretch gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border backdrop-blur-xl transition-all duration-300 transform group ${
        config.containerClasses
      } ${
        isDismissing 
          ? 'opacity-0 translate-y-2 scale-95' 
          : 'opacity-100 translate-y-0 scale-100 animate-slide-up'
      }`}
    >
      <div className={`flex items-center justify-center p-2 rounded-xl shrink-0 self-center ${config.iconClasses}`}>
        {config.icon}
      </div>
      <div className="flex-1 flex flex-col justify-center py-0.5 min-w-0 pr-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-[900] tracking-widest border uppercase ${config.badgeBg}`}>
            {config.isCritical && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
            {config.label}
          </span>
        </div>
        <p className="text-xs sm:text-[13px] font-bold leading-snug text-white/95 break-words">
          {typeof message === 'object' && message !== null ? (message as any).message || (message as any).title || JSON.stringify(message) : String(message ?? '')}
        </p>
        {action && (
          <button
            onClick={() => {
              action.onClick();
              handleDismiss();
            }}
            className="mt-2.5 self-start flex items-center gap-1.5 px-3 py-1.5 kinetic-gradient text-white text-[9px] font-black uppercase tracking-[0.1em] rounded-lg shadow-md active:scale-95 transition-all"
          >
            <Download className="w-3 h-3" />
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex items-center justify-center p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0 self-start"
        title="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Sleek countdown timer progress bar */}
      {dur > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
          <div 
            className={`h-full ${config.progressBar}`}
            style={{
              animation: `toast-progress ${dur}ms linear forwards`
            }}
          />
        </div>
      )}
    </div>
  );
};
