import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.js";
import { rideApi } from "@/services/rideApi.js";

export function DriverCancelRidePage() {
  const { session } = useAuth();
  const driverId = session?.subject_id || session?.id || session?.driverId;
  const navigate = useNavigate();
  const { state } = useLocation();
  const { rideId } = useParams();
  
  const ride = state?.ride || {};

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState("");

  const handleKeep = () => {
    // Go back to the previous screen (e.g. In progress)
    navigate(-1);
  };

  const handleCancel = async () => {
    if (!rideId || !driverId) return;
    if (!reason) {
      setError("Vui lòng chọn lý do hủy chuyển.");
      return;
    }
    
    setLoading(true);
    try {
      await rideApi.cancelRide(rideId, reason);
      navigate("/driver/availability/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Không thể hủy chuyến");
    } finally {
      setLoading(false);
    }
  };

  const reasonsList = [
    "Khách không xuất hiện",
    "Không liên lạc được với khách",
    "Sự cố phương tiện",
    "Lý do khác"
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Huỷ chuyến đi</h1>
            <p className="text-xs text-slate-500 mt-0.5">Driver App</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">Online</span>
        </div>

        <div className="flex-1 px-6 py-6">
          <div className="w-full h-full rounded-2xl bg-slate-200 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center mb-3 pointer-events-none">
              <div className="w-6 h-6 bg-blue-600 rounded-full border-4 border-white" />
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-blue-600 -mt-1" />
            </div>

            <div className="text-xs tracking-wide text-slate-500 select-none">MAP VIEW</div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="rounded-2xl bg-red-50 p-4 mb-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">⚠️</div>
            <p className="text-xs text-red-700">
              Việc huỷ chuyến có thể ảnh hưởng đến điểm đánh giá và quyền nhận cuốc của bạn.
            </p>
          </div>

          <div className="rounded-2xl border p-4 mb-4 space-y-3">
            <p className="text-sm font-medium mb-2">Lý do huỷ chuyến</p>

            {reasonsList.map(r => (
              <label key={r} className="flex items-center gap-3 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="cancel_reason" 
                  value={r}
                  checked={reason === r}
                  onChange={(e) => setReason(e.target.value)}
                />
                {r}
              </label>
            ))}
          </div>
          
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <div className="flex gap-3 mb-4">
            <button 
              onClick={handleKeep}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:scale-[0.98]">
              Giữ chuyến
            </button>
            <button 
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-red-500 py-3 text-sm font-medium text-red-600 active:scale-[0.98]">
              {loading ? "Đang xử lý..." : "Xác nhận huỷ"}
            </button>
          </div>

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
