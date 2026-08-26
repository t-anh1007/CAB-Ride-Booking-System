export function StatusChip({ tone = "neutral", children, className = "" }) {
  return <span className={`cab-chip cab-chip--${tone} ${className}`.trim()}>{children}</span>;
}
