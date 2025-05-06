import { useState, useRef, useEffect } from "react";

export interface Notification {
  type: "success" | "error" | "info";
  title: string;
  message: string;
  id: number;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: number) => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-3 rounded-md shadow-md transition-opacity animate-slide-in flex items-start ${
            notification.type === "success"
              ? "bg-green-100 border-l-4 border-green-500 text-green-700"
              : notification.type === "error"
              ? "bg-red-100 border-l-4 border-red-500 text-red-700"
              : "bg-blue-100 border-l-4 border-blue-500 text-blue-700"
          }`}
        >
          <div className="flex-1">
            <div className="font-medium">{notification.title}</div>
            <div className="text-sm">{notification.message}</div>
          </div>
          <button
            onClick={() => onDismiss(notification.id)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationIdRef = useRef(0);

  const showNotification = (
    type: "success" | "error" | "info",
    title: string,
    message: string
  ) => {
    const id = notificationIdRef.current++;
    setNotifications((prev) => [...prev, { type, title, message, id }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const dismissNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return {
    notifications,
    showNotification,
    dismissNotification,
  };
};

export default NotificationSystem;