const titles = { loading: "Đang tải", empty: "Chưa có dữ liệu", error: "Không thể tải dữ liệu" };
const readableDetail = (detail) => {
  if (typeof detail === "string") return detail;
  if (!detail || typeof detail !== "object") return detail ? "Yêu cầu chưa hoàn tất. Vui lòng thử lại." : "";
  for (const candidate of [detail.message, detail.error?.message, detail.payload?.message, detail.code]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "Yêu cầu chưa hoàn tất. Vui lòng thử lại.";
};

export function SurfaceState({ kind = "empty", title = titles[kind], detail, action }) {
  const detailText = readableDetail(detail);

  return <section className={`cab-surface-state cab-surface-state--${kind}`} role={kind === "error" ? "alert" : "status"}>
    <h2>{title}</h2>
    {detailText ? <p>{detailText}</p> : null}
    {action ? <div className="cab-surface-state__action">{action}</div> : null}
  </section>;
}
