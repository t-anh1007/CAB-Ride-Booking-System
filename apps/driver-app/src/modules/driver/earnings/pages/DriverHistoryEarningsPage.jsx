import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.js";
import { rideApi } from "@/services/rideApi.js";

export function DriverHistoryEarningsPage() {
  const { session } = useAuth();
  const driverId = session?.subject_id || session?.id || session?.driverId;
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;
    const fetchHistory = async () => {
      try {
        const res = await rideApi.getHistory(driverId);
        // Assuming data is an array of rides
        setRides(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [driverId]);

  const today = new Date().toLocaleDateString('vi-VN');
  
  const todayRides = rides.filter(ride => {
    if (!ride.createdAt) return false;
    const rideDate = new Date(ride.createdAt).toLocaleDateString('vi-VN');
    return rideDate === today;
  });

  const completedTodayRides = todayRides.filter(ride => ride.status === 'COMPLETED');
  const totalEarnings = completedTodayRides.reduce((sum, ride) => sum + (Number(ride.priceSnapshot || ride.estimatedPrice || ride.estimatedFare) || 0), 0);
  const totalRides = completedTodayRides.length;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Thu nhập & lịch sử</h1>
          <p className="text-xs text-slate-500 mt-0.5">Driver App</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-xs text-green-700 mb-1">Thu nhập hôm nay</p>
            <p className="text-2xl font-semibold text-green-800">
              {loading ? "..." : `${totalEarnings.toLocaleString('vi-VN')}đ`}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Số chuyến</p>
                <p className="font-semibold text-slate-900">{loading ? "..." : totalRides}</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Giờ hoạt động</p>
                <p className="font-semibold text-slate-900">6h 30p</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-900">Lịch sử chuyến đi</p>
            
            {loading ? (
              <p className="text-sm text-slate-500 text-center">Đang tải...</p>
            ) : rides.length === 0 ? (
              <p className="text-sm text-slate-500 text-center">Chưa có chuyến đi nào.</p>
            ) : (
              rides.map((ride) => (
                <div key={ride.rideId || ride._id} className="rounded-2xl border p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium line-clamp-1">{ride.pickup?.address} → {ride.destination?.address}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(ride.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">{ride.status}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-700">
                      +{Number(ride.priceSnapshot || ride.estimatedPrice || ride.estimatedFare || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
