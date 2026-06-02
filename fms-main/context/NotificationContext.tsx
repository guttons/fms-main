import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Check, AlertTriangle, Info, X, AlertOctagon, Download } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

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

interface NotificationContextType {
  notify: (message: string, type?: NotificationType) => void;
  notifyWithAction: (message: string, type: NotificationType, action: NotificationAction, duration?: number) => string;
  dismiss: (id: string) => void;
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
      // Limit to 5 active notifications
      return newNotifs.length > 5 ? newNotifs.slice(newNotifs.length - 5) : newNotifs;
    });

    const dur = notif.duration !== undefined ? notif.duration : 5000;
    if (dur > 0) {
      setTimeout(() => removeNotification(notif.id), dur);
    }
  }, [removeNotification]);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    addNotification({ id, message, type });
  }, [addNotification]);

  const notifyWithAction = useCallback((
    message: string,
    type: NotificationType,
    action: NotificationAction,
    duration = 0
  ): string => {
    const id = Math.random().toString(36).substring(2, 9);
    addNotification({ id, message, type, action, duration });
    return id;
  }, [addNotification]);

  const dismiss = useCallback((id: string) => {
    removeNotification(id);
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ notify, notifyWithAction, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[10000] flex flex-col gap-3 pointer-events-none max-w-md w-auto sm:w-[380px]">
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

const Toast: React.FC<{ notification: Notification; onClose: () => void }> = ({ notification, onClose }) => {
  const { type, message, action } = notification;

  const config = {
    success: {
      icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />,
      classes: 'bg-surface border-success/30 text-success shadow-success/10',
      iconClasses: 'bg-success/10 text-success',
      label: 'Success'
    },
    error: {
      icon: <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5" />,
      classes: 'bg-surface border-error/30 text-error shadow-error/10',
      iconClasses: 'bg-error/10 text-error',
      label: 'Error'
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />,
      classes: 'bg-surface border-warning/30 text-warning shadow-warning/10',
      iconClasses: 'bg-warning/10 text-warning',
      label: 'Warning'
    },
    info: {
      icon: <Info className="w-4 h-4 sm:w-5 sm:h-5" />,
      classes: 'bg-surface border-primary/30 text-primary shadow-primary/10',
      iconClasses: 'bg-primary/10 text-primary',
      label: 'Info'
    }
  }[type];

  return (
    <div
      className={`pointer-events-auto flex items-stretch gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 shadow-2xl animate-slide-up group ${config.classes}`}
    >
      <div className={`flex items-center justify-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${config.iconClasses}`}>
        {config.icon}
      </div>
      <div className="flex-1 flex flex-col justify-center py-0.5 min-w-0">
        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">{config.label}</p>
        <p className="text-xs sm:text-sm font-bold leading-tight line-clamp-2">{message}</p>
        {action && (
          <button
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className="mt-2 self-start flex items-center gap-1.5 px-3 py-1.5 kinetic-gradient text-white text-[9px] font-black uppercase tracking-[0.1em] rounded-lg shadow-md active:scale-95 transition-all"
          >
            <Download className="w-3 h-3" />
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex items-center justify-center p-1 rounded-lg hover:bg-surface-dim transition-colors shrink-0 self-start"
      >
        <X className="w-4 h-4 opacity-40 group-hover:opacity-100" />
      </button>
    </div>
  );
};
