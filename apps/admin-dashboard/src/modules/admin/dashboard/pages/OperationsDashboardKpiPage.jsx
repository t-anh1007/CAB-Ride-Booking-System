import { useEffect, useState } from "react";
import { request } from "@/services/httpClient.js";

export function OperationsDashboardKpiPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await request("/api/v1/rides/stats");
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Tổng quan vận hành</h1>
          <p className="text-sm text-slate-500 mt-0.5">Operations Dashboard</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-xs text-blue-600 mb-1">Tổng Chuyến</p>
              <p className="text-2xl font-semibold text-blue-900">{stats?.totalRides || "..."}</p>
              <p className="text-xs text-blue-500 mt-1">Hệ thống</p>
            </div>

            <div className="rounded-2xl bg-green-50 p-4">
              <p className="text-xs text-green-600 mb-1">Hoàn thành</p>
              <p className="text-2xl font-semibold text-green-900">{stats?.byStatus?.completed || 0}</p>
              <p className="text-xs text-green-500 mt-1">Chuyến xe</p>
            </div>

            <div className="rounded-2xl bg-purple-50 p-4">
              <p className="text-xs text-purple-600 mb-1">Đang tìm tài xế</p>
              <p className="text-2xl font-semibold text-purple-900">{stats?.byStatus?.searching || 0}</p>
              <p className="text-xs text-purple-500 mt-1">Live</p>
            </div>

            <div className="rounded-2xl bg-yellow-50 p-4">
              <p className="text-xs text-yellow-600 mb-1">Đang di chuyển</p>
              <p className="text-2xl font-semibold text-yellow-900">{stats?.byStatus?.inProgress || 0}</p>
              <p className="text-xs text-yellow-500 mt-1">Live</p>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm font-medium mb-3">Trạng thái hệ thống</p>
            <div className="space-y-2 text-sm">
              {[
                ["Booking Service", stats ? "Hoạt động" : "Kết nối..."],
                ["Ride Service", stats ? "Hoạt động" : "Kết nối..."],
                ["Pricing Service", "Hoạt động"],
                ["Matching Service", "Hoạt động"]
              ].map(([label, status]) => (
                <div key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span className={`${status === "Hoạt động" ? "text-green-600" : "text-slate-400"} font-medium`}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm font-medium mb-3">Thao tác nhanh</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {["User Management", "Driver KYC", "Booking Monitor", "System Logs"].map((item) => (
                <button key={item} className="rounded-xl bg-slate-100 py-3 active:bg-slate-200">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
