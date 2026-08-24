import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RealtimeContext } from "@app/RealtimeProvider.jsx";
import { AuthContext } from "@app/AuthProvider.jsx";
import { useDriverRide } from "@app/DriverRideProvider.jsx";
import { driverApi } from "@/services/driverApi.js";

export function DriverOnlineOfflineDashboardPage() {
  const navigate = useNavigate();
  const { connect, disconnect, status } = useContext(RealtimeContext);
  const { session } = useContext(AuthContext);
  const { onlineStatus, setOnlineStatus, setCurrentRide } = useDriverRide();

  const [driverInfo, setDriverInfo] = useState(null);

  const toggleOnline = async () => {
    const driverId = session?.user?.subject_id || session?.user?.id || session?.id || "driver-123";
    
    if (onlineStatus === "ONLINE") {
      try {
        await driverApi.goOffline(driverId);
        disconnect();
        setOnlineStatus("OFFLINE");
      } catch (error) {
        alert("Lỗi khi tắt trực tuyến");
      }
    } else {
      try {
        await driverApi.goOnline(driverId);
        setOnlineStatus("ONLINE");
      } catch (error) {
        alert("Lỗi khi bật trực tuyến");
      }
    }
  };

  useEffect(() => {
    const driverId = session?.user?.subject_id || session?.user?.id || session?.id || "driver-123";
    
    const fetchDriver = async () => {
      try {
        const result = await driverApi.getDriver(driverId);
        setDriverInfo(result.data || result);
      } catch (e) {
        console.error("Fetch driver error:", e);
      }
    };

    fetchDriver();
  }, [session]);

  useEffect(() => {
    if (onlineStatus === "ONLINE" && status !== "open" && status !== "connecting") {
      connect({
        client: "driver",
        token: session?.accessToken,
        onMessage: (data) => {
          try {
            const message = JSON.parse(data);
            if (message.type === "ride.assigned" || message.type === "DriverAssigned" || message.type === "ride_requested" || message.type === "ride_assigned") {
              setCurrentRide(message.payload || message);
              navigate("/driver/ride/incoming-request");
            }
          } catch (e) {
            console.error("WS Message Error:", e);
          }
        }
      });
    }
  }, [onlineStatus, status, connect, session?.accessToken, setCurrentRide, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Bảng điều khiển</h1>
          <p className="text-xs text-slate-500 mt-0.5">Driver App</p>
        </div>

        <div className="px-6 py-6">
          <div
            className={`rounded-2xl border p-4 flex items-center justify-between cursor-pointer transition-all ${
              onlineStatus === "ONLINE" ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
            }`}
            onClick={toggleOnline}
          >
            <div>
              <p className={`text-sm font-semibold ${onlineStatus === "ONLINE" ? "text-green-700" : "text-slate-700"}`}>
                {onlineStatus === "ONLINE" ? "Đang Online" : "Đang Offline"}
              </p>
              <p className={`text-xs ${onlineStatus === "ONLINE" ? "text-green-600" : "text-slate-500"}`}>
                {onlineStatus === "ONLINE" ? "Sẵn sàng nhận chuyến" : "Bật để nhận chuyến mới"}
              </p>
            </div>

            <div className={`w-14 h-8 rounded-full transition-colors relative ${onlineStatus === "ONLINE" ? "bg-green-600" : "bg-slate-400"}`}>
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                  onlineStatus === "ONLINE" ? "right-1" : "left-1"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="px-6 grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Thu nhập hôm nay</p>
            <p className="text-lg font-semibold text-slate-900">{driverInfo?.todayEarnings?.toLocaleString() || "0"}đ</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Số chuyến</p>
            <p className="text-lg font-semibold text-slate-900">{driverInfo?.totalTrips || "0"}</p>
          </div>
        </div>

        <div className="flex-1 px-6 pb-6">
          <div className="w-full h-full rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 text-sm">
            MAP VIEW
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
