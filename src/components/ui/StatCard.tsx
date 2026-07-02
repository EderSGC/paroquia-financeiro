import { type ReactNode } from "react";

interface StatRow {
  label: string;
  value: ReactNode;
  valueColor?: string;
}

interface Props {
  label: string;
  value?: ReactNode;
  subtitle?: string;
  rows?: StatRow[];
  span2?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export function StatCard({ label, value, subtitle, rows, span2, onClick, children }: Props) {
  const base: React.CSSProperties = {
    border: "1px solid var(--border-card)",
    borderRadius: 12,
    background: "var(--bg-elevated)",
    backdropFilter: "var(--blur-md)",
    WebkitBackdropFilter: "var(--blur-md)",
    boxShadow: "var(--shadow-card)",
    padding: "14px 16px",
    gridColumn: span2 ? "span 2" : undefined,
    cursor: onClick ? "pointer" : undefined,
    transition: "box-shadow 200ms ease, transform 200ms ease",
  };

  return (
    <div
      style={base}
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow-hover)";
        if (onClick) el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow-card)";
        el.style.transform = "";
      }}
    >
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.5px",
        textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: value ? 6 : 8,
      }}>
        {label}
      </div>

      {value != null && (
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, letterSpacing: "-0.5px" }}>
          {value}
        </div>
      )}

      {subtitle && (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
          {subtitle}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ marginTop: value ? 8 : 0 }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "3px 0",
                borderBottom: i < rows.length - 1 ? "1px solid var(--separator)" : undefined,
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: row.valueColor ?? "var(--text-primary)" }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

/* Thin progress bar used inside StatCard or PanelSection */
export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
      <div style={{ flex: 1, height: 6, background: "var(--separator)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 3, transition: "width 400ms ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", minWidth: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}
