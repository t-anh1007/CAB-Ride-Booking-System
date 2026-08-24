import { useNavigate } from "react-router-dom";

export function CustomerOnboardingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 px-4 flex items-center justify-center">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-2xl font-bold tracking-tight">CAB Booking</h1>
          <p className="text-slate-500 text-sm mt-1">Ứng dụng đặt xe thông minh</p>

          <div className="mt-16">
            <div className="text-6xl">🚕</div>
            <h2 className="text-xl font-semibold mt-5">Đặt xe nhanh chóng</h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Chỉ vài thao tác để bắt đầu chuyến đi của bạn
            </p>
          </div>
        </div>

        <div className="px-6 pb-8">
          <button
            className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-medium active:scale-[0.98]"
            onClick={() => navigate("/customer/auth/login")}
          >
            Bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
}
