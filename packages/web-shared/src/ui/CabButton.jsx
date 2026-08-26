export function CabButton({ variant = "primary", busy = false, disabled = false, children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`cab-button cab-button--${variant} ${className}`.trim()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {children}
    </button>
  );
}
