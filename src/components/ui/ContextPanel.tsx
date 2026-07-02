import { type ReactNode } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useWorkspace } from "@/layouts/WorkspaceContext";

interface Props {
  title: string;
  children: ReactNode;
}

export function ContextPanel({ title, children }: Props) {
  const { panelOpen, togglePanel } = useWorkspace();

  return (
    <div
      className="context-panel-root"
      style={{
        width: panelOpen ? 280 : 40,
        minWidth: panelOpen ? 200 : 40,
        maxWidth: panelOpen ? 320 : 40,
        transition: "width 220ms cubic-bezier(.4,0,.2,1), min-width 220ms cubic-bezier(.4,0,.2,1)",
        backdropFilter: "var(--blur-lg)",
        WebkitBackdropFilter: "var(--blur-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        flexShrink: 1,
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={togglePanel}
        title={panelOpen ? "Fechar painel contextual" : "Abrir painel contextual"}
        style={{
          position: "absolute",
          top: 10,
          left: panelOpen ? "auto" : "50%",
          right: panelOpen ? 10 : "auto",
          transform: panelOpen ? "none" : "translateX(-50%)",
          zIndex: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-card)",
          boxShadow: "var(--shadow-card)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          padding: 0,
          flexShrink: 0,
        }}
      >
        {panelOpen ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {panelOpen && (
        <>
          <div
            style={{
              padding: "13px 16px 12px",
              paddingRight: 44,
              borderBottom: "1px solid var(--separator)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "-0.1px",
                color: "var(--text-primary)",
                opacity: 0.82,
                lineHeight: 1.3,
              }}
            >
              {title}
            </div>
          </div>

          <div
            className="mac-scrollbar panel-content"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 16px 20px",
            }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
