import { useNavigate } from "react-router-dom";

export function DriverKycBlockedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-3xl mb-6">⛔</div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Tạm thời không thể nhận cuốc</h1>

          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Hồ sơ xác minh (KYC) của bạn
            <br />
            chưa được duyệt hoặc cần bổ sung thông tin.
            <br />
            Vui lòng hoàn tất KYC để tiếp tục nhận cuốc.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left w-full mb-6">
            <p className="text-xs text-slate-600 mb-2">Những việc cần làm:</p>
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              <li>Kiểm tra lại giấy tờ cá nhân</li>
              <li>Bổ sung ảnh/giấy tờ theo yêu cầu</li>
              <li>Đảm bảo thông tin xe chính xác</li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          <button 
            onClick={() => navigate("/driver/kyc/vehicle-profile")}
            className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]"
          >
            Cập nhật KYC
          </button>

          <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
            Liên hệ hỗ trợ
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
