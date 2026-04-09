import { createContext, useContext, type ReactNode } from 'react';
import { useNotificationStore } from '../stores/useNotificationStore';

interface NotificationContextType {
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType>({ unreadCount: 0 });

export function NotificationProvider({ children }: { children: ReactNode }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <NotificationContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotificationContext = () => useContext(NotificationContext);
