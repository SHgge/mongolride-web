import { useEffect } from 'react';
import { useNotificationStore } from '../stores/useNotificationStore';
import { notificationService } from '../services/notification.service';
import { useAuth } from './useAuth';
import type { Notification } from '../types/notification.types';

export function useNotifications() {
  const { user } = useAuth();
  const { notifications, unreadCount, setNotifications, setUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!user) return;
    notificationService.getNotifications(user.id).then(({ data }) => {
      const items = (data ?? []) as Notification[];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.is_read).length);
    });
  }, [user, setNotifications, setUnreadCount]);

  return { notifications, unreadCount };
}
