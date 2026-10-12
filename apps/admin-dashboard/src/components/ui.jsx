const paths = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  car: "M5 16h14M6 16l1.5-5h9L18 16M5 16v3h2v-2h10v2h2v-3M8 13.5h.01M16 13.5h.01",
  driver: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  zone: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  audit: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  refresh: "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  chevron: "M6 9l6 6 6-6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
};

export function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

const tones = {
  completed: ["done", "Hoàn thành"], COMPLETED: ["done", "Hoàn thành"],
  in_progress: ["ongoing", "Đang đi"], IN_PROGRESS: ["ongoing", "Đang đi"], ongoing: ["ongoing", "Đang đi"],
  cancelled: ["cancelled", "Đã hủy"], CANCELLED: ["cancelled", "Đã hủy"],
  pending: ["pending", "Chờ xác nhận"], PENDING: ["pending", "Chờ xác nhận"], REQUESTED: ["pending", "Chờ xác nhận"],
  success: ["success", "Thành công"], SUCCESS: ["success", "Thành công"],
  failure: ["danger", "Lỗi"], FAILURE: ["danger", "Lỗi"], failed: ["danger", "Lỗi"], error: ["danger", "Lỗi"],
  warning: ["warning", "Cảnh báo"], processing: ["info", "Đang xử lý"],
  available: ["success", "Trực tuyến"], AVAILABLE: ["success", "Trực tuyến"], online: ["success", "Trực tuyến"], ONLINE: ["success", "Trực tuyến"],
};

export function Chip({ status, tone, children }) {
  const [t, label] = tones[status] || [tone || "neutral", status];
  return <span className={`ad-chip ad-chip--${tone || t}`}>{children ?? label ?? "—"}</span>;
}

export function Panel({ title, action, children, className = "" }) {
  return <section className={`ad-panel ${className}`}>
    {(title || action) && <header className="ad-panel__head"><h2>{title}</h2>{action}</header>}
    {children}
  </section>;
}

export function PageHead({ eyebrow, title, children }) {
  return <header className="ad-pagehead"><div><p className="ad-eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children && <div className="ad-pagehead__tools">{children}</div>}</header>;
}

export function Loading({ text = "Đang tải dữ liệu…" }) {
  return <div className="ad-state" role="status"><span className="ad-spinner" />{text}</div>;
}

export function DemoNote({ children = "Không kết nối được hệ thống — đang hiển thị dữ liệu minh họa." }) {
  return <p className="ad-demo-note" role="status">{children}</p>;
}
