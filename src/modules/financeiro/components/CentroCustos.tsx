// src/modules/financeiro/components/CentroCustos.tsx
import React, { useEffect, useState, useCallback } from "react";
import { getDb } from "@core/database";
import { colors, spacing, typography } from "../../../design";

interface Resumo { origem: string; entradas: number; saidas: number; saldo: number; }

export const CentroCustos: React.FC = () => {
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const db = await getDb();
      const [anoStr, mesStr] = mes.split("-");
      const inicio = `${anoStr}-${mesStr}-01`;
      const fim = `${anoStr}-${mesStr}-31`;
      const entradas = await db.select<{ origem: string; total: number }[]>(
        "SELECT COALESCE(origem,'PAROQUIA') as origem, SUM(valor) as total FROM lancamentos WHERE tipo='ENTRADA' AND data BETWEEN ? AND ? AND deleted_at IS NULL GROUP BY origem",
        [inicio, fim]
      );
      const saidas = await db.select<{ origem: string; total: number }[]>(
        "SELECT COALESCE(origem,'PAROQUIA') as origem, SUM(valor) as total FROM lancamentos WHERE tipo='SAIDA' AND data BETWEEN ? AND ? AND deleted_at IS NULL GROUP BY origem",
        [inicio, fim]
      );
      const origens = [...new Set([...entradas, ...saidas].map(r => r.origem))];
      const resultado: Resumo[] = origens.map(orig => {
        const e = entradas.find(r => r.origem === orig)?.total ?? 0;
        const s = saidas.find(r => r.origem === orig)?.total ?? 0;
        return { origem: orig, entradas: e, saidas: s, saldo: e - s };
      }).sort((a, b) => b.saldo - a.saldo);
      setResumos(resultado);
    } catch (e) { console.error(e); } finally { setCarregando(false); }
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalEntradas = resumos.reduce((s, r) => s + r.entradas, 0);
  const totalSaidas = resumos.reduce((s, r) => s + r.saidas, 0);
  const totalSaldo = totalEntradas - totalSaidas;

  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Filtro de mês */}
      <div style={{ display: "flex", gap: spacing.md, alignItems: "center", marginBottom: spacing.lg }}>
        <label style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textSecondary }}>Período:</label>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }} />
        <button onClick={carregar} style={{ padding: "8px 16px", background: colors.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}>
          Atualizar
        </button>
      </div>

      {/* Cards de totais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md, marginBottom: spacing.lg }}>
        {[
          { label: "Total Entradas", valor: fmt(totalEntradas), cor: colors.success },
          { label: "Total Saídas", valor: fmt(totalSaidas), cor: colors.danger },
          { label: "Saldo do Período", valor: (totalSaldo >= 0 ? "+" : "−") + fmt(totalSaldo), cor: totalSaldo >= 0 ? colors.success : colors.danger },
        ].map(c => (
          <div key={c.label} style={{ background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, padding: spacing.lg }}>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.cor }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {/* Tabela por centro de custo (unidade) */}
      <div style={{ background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
        <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontWeight: 700, fontSize: typography.fontSize.sm }}>Resultado por Unidade</span>
        </div>
        {carregando ? <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Calculando...</div> : resumos.length === 0 ? (
          <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Sem lançamentos no período selecionado.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: colors.surfaceSoft }}>
              {["Unidade","Entradas","Saídas","Saldo"].map((h, i) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: i === 0 ? "left" : "right", fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {resumos.map(r => (
                <tr key={r.origem} style={{ borderTop: `1px solid ${colors.divider}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: typography.fontSize.sm }}>{r.origem}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: colors.success, fontWeight: 600 }}>{fmt(r.entradas)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: colors.danger, fontWeight: 600 }}>{fmt(r.saidas)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: r.saldo >= 0 ? colors.success : colors.danger }}>
                    {r.saldo >= 0 ? "+" : "−"}{fmt(r.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
