import { ChevronLeft } from "lucide-react";
import { useWorkspace, type SelectedItem } from "@/layouts/WorkspaceContext";
import { PanelSection } from "@/components/ui/SectionHeader";

/* ─── Shared row styles ───────────────────────────────────────── */
const ROW: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  padding: "5px 0", borderBottom: "1px solid var(--separator)", gap: 8,
};
const LABEL: React.CSSProperties = { color: "var(--text-secondary)", fontSize: 11, flexShrink: 0 };
const VALUE: React.CSSProperties = { fontWeight: 600, color: "var(--text-primary)", fontSize: 11, textAlign: "right", wordBreak: "break-word" };

/* ─── Lançamento detail ───────────────────────────────────────── */
type LancItem = Extract<SelectedItem, { type: "lancamento" }>;

function LancamentoDetail({ item }: { item: LancItem }) {
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (s: string) => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—";
  const isEntrada = item.tipoLanc === "ENTRADA";

  return (
    <>
      <div style={{
        borderRadius: 10,
        background: isEntrada ? "rgba(52,199,89,0.09)" : "rgba(255,59,48,0.09)",
        border: `1px solid ${isEntrada ? "rgba(52,199,89,0.18)" : "rgba(255,59,48,0.18)"}`,
        padding: "12px 14px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
          {isEntrada ? "Receita" : "Despesa"}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: isEntrada ? "var(--accent-green)" : "var(--accent-red)", lineHeight: 1 }}>
          {fmt(item.valor)}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{fmtDate(item.data)}</div>
      </div>

      <PanelSection title="Detalhes">
        <div style={ROW}><span style={LABEL}>Descrição</span><span style={{ ...VALUE, fontSize: 10 }}>{item.descricao || "—"}</span></div>
        {item.categoria && <div style={ROW}><span style={LABEL}>Categoria</span><span style={VALUE}>{item.categoria}</span></div>}
        {item.origem && <div style={ROW}><span style={LABEL}>Unidade</span><span style={VALUE}>{item.origem}</span></div>}
      </PanelSection>
    </>
  );
}

/* ─── Exported entry ──────────────────────────────────────────── */
export function ItemDetailPanel() {
  const { selectedItem, selectItem } = useWorkspace();
  if (!selectedItem) return null;

  return (
    <div key={`${selectedItem.type}-${selectedItem.id}`} className="item-detail-content">
      <button
        onClick={() => selectItem(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--accent)", fontSize: 12, fontWeight: 500, padding: "4px 0",
          fontFamily: "inherit", transition: "opacity 150ms ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        <ChevronLeft size={13} />
        Voltar
      </button>

      {selectedItem.type === "lancamento" && <LancamentoDetail item={selectedItem} />}
    </div>
  );
}
