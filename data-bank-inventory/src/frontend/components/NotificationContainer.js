import React from 'react';
import { useNotifications } from '../../backend/contexts/NotificationContext';

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'var(--success)';
      case 'error': return 'var(--error)';
      case 'warning': return 'var(--warning)';
      case 'info': return 'var(--accent-primary)';
      default: return 'var(--text-muted)';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          style={{ borderLeftColor: getNotificationColor(notification.type) }}
        >
          <div className="notification-content">
            <div className="notification-icon">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="notification-text">
              {notification.title && (
                <div className="notification-title">{notification.title}</div>
              )}
              {notification.message && (
                <div className="notification-message">{notification.message}</div>
              )}
            </div>
            <button
              className="notification-close"
              onClick={() => removeNotification(notification.id)}
              title="Close notification"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
