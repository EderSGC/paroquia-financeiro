import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ children, action }: Props) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 10,
    }}>
      <h2 style={{
        margin: 0,
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
      }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

/* Section label inside the ContextPanel */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.6px",
        textTransform: "uppercase", color: "var(--text-tertiary)",
        marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function PanelDivider() {
  return <div style={{ height: 1, background: "var(--separator)", margin: "16px 0" }} />;
}

export function PanelRow({ label, value, valueColor }: { label: string; value: ReactNode; valueColor?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 0", borderBottom: "1px solid var(--separator)", fontSize: 12,
    }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: valueColor ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
