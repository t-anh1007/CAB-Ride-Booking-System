export function ServiceHealthArchitecturePage() {
  const services = [
    ["Booking Service", "Healthy", "bg-green-100 text-green-700", "Latency: 95ms", "Error: 0.1%"],
    ["Payment Service", "Degraded", "bg-yellow-100 text-yellow-700", "Latency: 320ms", "Error: 1.8%"],
    ["Realtime Map", "Healthy", "bg-green-100 text-green-700", "Latency: 140ms", "Error: 0.3%"],
    ["Notification Service", "Healthy", "bg-green-100 text-green-700", "Latency: 80ms", "Error: 0.05%"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Sức khỏe hệ thống</h1>
          <p className="text-sm text-slate-500 mt-0.5">Service Health & Architecture</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-xs text-green-700 mb-1">Trạng thái tổng thể</p>
            <p className="text-lg font-semibold text-green-900">Hệ thống đang hoạt động ổn định</p>
            <p className="text-xs text-green-600 mt-1">Không ghi nhận sự cố nghiêm trọng</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["Uptime", "99.98%"],
              ["Latency", "120ms"],
              ["Error rate", "0.2%"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {services.map(([name, status, statusClass, latency, error]) => (
              <div key={name} className="rounded-2xl border p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold">{name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{latency}</span>
                  <span>{error}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            Kiến trúc microservice với các thành phần độc lập giúp hệ thống chịu tải tốt và cô lập lỗi hiệu quả.
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
