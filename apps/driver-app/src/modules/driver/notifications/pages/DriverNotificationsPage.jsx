import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.js";
import { notificationApi } from "@/services/notificationApi.js";

export function DriverNotificationsPage() {
  const { session } = useAuth();
  const userId = session?.subject_id || session?.id || session?.driverId;
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetchNotifications = async () => {
      try {
        const res = await notificationApi.getNotifications(userId);
        setNotifications(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [userId]);

  const getIcon = (type) => {
    switch (type) {
      case "ride": return "🚕";
      case "payment": return "💰";
      case "system": return "⚙️";
      case "kyc": return "🛂";
      default: return "🔔";
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case "ride": return "bg-blue-100";
      case "payment": return "bg-green-100";
      case "system": return "bg-slate-100";
      case "kyc": return "bg-yellow-100";
      default: return "bg-slate-100";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Thông báo</h1>
          <p className="text-xs text-slate-500 mt-0.5">Driver App</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-6">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-10">Đang tải thông báo...</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-4xl mb-2">📭</span>
              <p className="text-sm">Không có thông báo nào.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.notificationId || notif.id} className="rounded-2xl border p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full ${getIconBg(notif.type)} flex items-center justify-center text-xl`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {new Date(notif.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
