import { printWithTitle } from "@core/utils/pdfGenerator";
// src/modules/financeiro/components/Relatorios.tsx
import React, { useEffect, useState, useCallback } from "react";
import { getDb } from "@core/database";
import { colors, spacing, typography } from "../../../design";

interface Lancamento { id: number; descricao: string; valor: number; tipo: string; data: string; categoria: string; origem: string; }

export const Relatorios: React.FC = () => {
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [inicio, setInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [fim, setFim] = useState(new Date().toISOString().split("T")[0]);
  const [filtroUnidade, setFiltroUnidade] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [comunidades, setComunidades] = useState<{ id: number; nome: string }[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const db = await getDb();
      let sql = "SELECT id, descricao, valor, tipo, data, COALESCE(categoria,'') as categoria, COALESCE(origem,'PAROQUIA') as origem FROM lancamentos WHERE data BETWEEN ? AND ? AND deleted_at IS NULL";
      const params: string[] = [inicio, fim];
      if (filtroUnidade !== "TODOS") { sql += " AND origem=?"; params.push(filtroUnidade); }
      if (filtroTipo !== "TODOS") { sql += " AND tipo=?"; params.push(filtroTipo); }
      sql += " ORDER BY data DESC, id DESC";
      const r = await db.select<Lancamento[]>(sql, params);
      setLista(r);
      const cs = await db.select<{ id: number; nome: string }[]>("SELECT id, nome FROM comunidades WHERE deleted_at IS NULL ORDER BY nome");
      setComunidades(cs);
    } catch (e) { console.error(e); } finally { setCarregando(false); }
  }, [inicio, fim, filtroUnidade, filtroTipo]);

  useEffect(() => { carregar(); }, [carregar]);

  const entradas = lista.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
  const saidas = lista.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
  const saldo = entradas - saidas;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const imprimir = () => printWithTitle("Relatório Financeiro");

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .relatorio-print, .relatorio-print * { visibility: visible; }
          .relatorio-print { position: absolute; left: 0; top: 0; width: 98%; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>

      {/* Filtros */}
      <div className="no-print" style={{ background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, padding: spacing.lg, marginBottom: spacing.lg }}>
        <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>Data Inicial</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>Data Final</label>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>Unidade</label>
            <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}>
              <option value="TODOS">Todas</option>
              <option value="PAROQUIA">Matriz Paroquial</option>
              {comunidades.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}>
              <option value="TODOS">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
            </select>
          </div>
          <button onClick={carregar} style={{ padding: "9px 16px", background: colors.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}>
            Filtrar
          </button>
          <button onClick={imprimir} style={{ padding: "9px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}>
            🖨️ Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md, marginBottom: spacing.lg }}>
        {[
          { label: "Entradas", valor: fmt(entradas), cor: colors.success },
          { label: "Saídas", valor: fmt(saidas), cor: colors.danger },
          { label: "Saldo", valor: (saldo >= 0 ? "+" : "−") + fmt(Math.abs(saldo)), cor: saldo >= 0 ? colors.success : colors.danger },
        ].map(c => (
          <div key={c.label} style={{ background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, padding: spacing.lg }}>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.cor }}>R$ {c.valor}</div>
          </div>
        ))}
      </div>

      {/* Conteúdo imprimível */}
      <div className="relatorio-print">
        <div style={{ textAlign: "center", marginBottom: 20, display: "none" }} id="print-only-header">
          <h2 style={{ margin: 0 }}>Relatório Financeiro</h2>
          <p style={{ margin: "4px 0" }}>Período: {new Date(inicio + "T12:00:00").toLocaleDateString("pt-BR")} a {new Date(fim + "T12:00:00").toLocaleDateString("pt-BR")}</p>
          <p style={{ margin: 0 }}>Entradas: R$ {fmt(entradas)} | Saídas: R$ {fmt(saidas)} | Saldo: R$ {fmt(saldo)}</p>
        </div>

        <div style={{ background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: `1px solid ${colors.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: typography.fontSize.sm }}>Lançamentos ({lista.length})</span>
          </div>
          {carregando ? <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Carregando...</div> : lista.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Nenhum lançamento no período.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: colors.surfaceSoft }}>
                  {["Data","Descrição","Categoria","Unidade","Tipo","Valor"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: i === 5 ? "right" : "left", fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lista.map(l => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${colors.divider}` }}>
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary, whiteSpace: "nowrap" }}>{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, fontWeight: 500 }}>{l.descricao}</td>
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{l.categoria || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{l.origem}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: l.tipo === "ENTRADA" ? "#d1fae5" : "#fee2e2", color: l.tipo === "ENTRADA" ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: 6, fontSize: typography.fontSize.xs, fontWeight: 600 }}>
                          {l.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: l.tipo === "ENTRADA" ? colors.success : colors.danger }}>
                        {l.tipo === "SAIDA" ? "−" : "+"}R$ {fmt(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
