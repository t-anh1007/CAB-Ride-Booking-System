export function AdminMfaChallengePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl">🛡️</div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Xác thực 2 lớp</h1>
              <p className="text-sm text-slate-500">Admin Dashboard Security</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            Nhập mã xác thực gồm 6 chữ số
            <br />
            từ ứng dụng Google Authenticator hoặc SMS.
          </p>

          <div className="flex justify-between gap-2 mb-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <input
                key={index}
                className="w-full h-14 rounded-xl border text-center text-xl font-semibold outline-none"
              />
            ))}
          </div>

          <p className="text-xs text-slate-500 text-center mb-8">
            Không nhận được mã? <span className="text-slate-900 font-medium">Gửi lại</span>
          </p>

          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Xác minh
          </button>

          <p className="text-xs text-slate-500 text-center mt-6">
            Hệ thống sử dụng xác thực MFA để bảo vệ dữ liệu quản trị
          </p>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
