import { type ReactNode } from "react";
import { Search } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  search?: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
  };
  actions?: ReactNode;
}

export function WorkspaceHeader({ title, subtitle, search, actions }: Props) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 16px",
      borderBottom: "1px solid var(--separator)",
      background: "var(--bg-header)",
      backdropFilter: "var(--blur-md)",
      WebkitBackdropFilter: "var(--blur-md)",
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>

      {search && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginLeft: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-card)",
          borderRadius: 14,
          padding: "4px 12px",
          width: 200,
        }}>
          <Search size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            style={{
              border: "none", outline: "none", background: "transparent",
              fontSize: 12, color: "var(--text-primary)", flex: 1, minWidth: 0,
            }}
          />
        </div>
      )}

      {actions && (
        <div style={{
          display: "flex", gap: 6, alignItems: "center",
          marginLeft: search ? 0 : "auto",
        }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function PrimaryButton({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px", fontSize: 12, fontWeight: 700,
        background: "var(--accent)", color: "#fff",
        border: "none", borderRadius: 6, cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

export function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 11px", fontSize: 10, fontWeight: 600,
        borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap",
        border: "1px solid var(--border-card)",
        background: active ? "var(--text-primary)" : "var(--bg-surface)",
        color: active ? "var(--bg-app, #fff)" : "var(--text-secondary)",
        fontFamily: "inherit",
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}
