// src/modules/financeiro/components/Receitas.tsx
import React, { useEffect, useState, useCallback } from "react";
import { getDb } from "@core/database";
import { FinanceiroRepository } from '../repository/financeiro.repository';
import { ModalConfirm, ModalAlert } from "../../../core/ui/Modal";
import { colors, spacing, typography } from "../../../design";
import { useWorkspace } from "@/layouts/WorkspaceContext";

const CATEGORIAS = [
  { value: "dizimo", label: "Dízimo" },
  { value: "coleta", label: "Coleta" },
  { value: "oferta_missa", label: "Oferta de Missa" },
  { value: "taxa_certidao", label: "Taxa de Certidão" },
  { value: "doacao", label: "Doação" },
  { value: "festa", label: "Festa/Quermesse" },
  { value: "campanha", label: "Campanha" },
  { value: "aluguel", label: "Aluguel" },
  { value: "venda", label: "Venda" },
  { value: "contribuicao_comunidade", label: "Contribuição da Comunidade" },
  { value: "repasse_recebido", label: "Repasse Recebido" },
  { value: "outros", label: "Outros" },
];

interface Lancamento { id: number; descricao: string; valor: number; data: string; categoria: string; origem: string; }

const inS: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, width: "100%", fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, boxSizing: "border-box", background: colors.surface, color: colors.text };

export const Receitas: React.FC = () => {
  const { selectItem } = useWorkspace();
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [categoria, setCategoria] = useState("coleta");
  const [origem, setOrigem] = useState("PAROQUIA");
  const [comunidades, setComunidades] = useState<{ id: number; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [idExcluir, setIdExcluir] = useState<number | null>(null);
  const [alerta, setAlerta] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const db = await getDb();
      const r = await db.select<Lancamento[]>(
        "SELECT id, descricao, valor, data, categoria, origem FROM lancamentos WHERE tipo='ENTRADA' AND deleted_at IS NULL ORDER BY data DESC, id DESC LIMIT 100"
      );
      setLista(r);
      const cs = await FinanceiroRepository.findComunidades();
      setComunidades(cs);
    } catch (e) { console.error(e); } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor) return;
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v <= 0) { setAlerta({ tipo: "erro", msg: "Valor inválido." }); return; }
    try {
      await FinanceiroRepository.lancamentos.create({
        descricao: descricao.trim(),
        valor: v,
        data,
        tipo: 'ENTRADA',
        categoria,
        origem,
      });
      setDescricao(""); setValor(""); setCategoria("coleta");
      await carregar();
      setAlerta({ tipo: "sucesso", msg: "Receita registrada com sucesso!" });
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao salvar receita." }); }
  };

  const confirmarExcluir = async () => {
    if (!idExcluir) return;
    try {
      await FinanceiroRepository.lancamentos.softDelete(idExcluir);
      await carregar();
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao excluir." }); }
    setIdExcluir(null);
  };

  const total = lista.reduce((s, l) => s + l.valor, 0);

  return (
    <div>
      <ModalConfirm aberto={idExcluir !== null} titulo="Excluir Receita" mensagem="Deseja excluir este lançamento permanentemente?" onConfirmar={confirmarExcluir} onCancelar={() => setIdExcluir(null)} />
      <ModalAlert aberto={!!alerta} tipo={alerta?.tipo ?? "info"} mensagem={alerta?.msg ?? ""} onFechar={() => setAlerta(null)} />

      <div style={{ display: "flex", gap: spacing.lg, alignItems: "flex-start" }}>
        <div style={{ width: 320, background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, padding: spacing.lg, flexShrink: 0 }}>
          <h3 style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.sm, fontWeight: 700, color: colors.success }}>+ Nova Receita</h3>
          <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inS} required />
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inS}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Unidade</label>
            <select value={origem} onChange={e => setOrigem(e.target.value)} style={inS}>
              <option value="PAROQUIA">Matriz Paroquial</option>
              {comunidades.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Descrição</label>
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Coleta do domingo..." style={inS} required />
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Valor (R$)</label>
            <input type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inS} required />
            <button type="submit" style={{ marginTop: 4, padding: "10px", background: colors.success, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: typography.fontFamily }}>
              Salvar Receita
            </button>
          </form>
        </div>

        <div style={{ flex: 1, background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: `1px solid ${colors.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: typography.fontSize.sm }}>Receitas Registradas ({lista.length})</span>
            <span style={{ fontWeight: 800, color: colors.success, fontSize: typography.fontSize.sm }}>Total: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          {carregando ? <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Carregando...</div> : lista.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Nenhuma receita registrada.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: colors.surfaceSoft }}>
                  {["Data","Descrição","Categoria","Unidade","Valor","Ação"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Valor" ? "right" : h === "Ação" ? "center" : "left", fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lista.map(l => (
                    <tr
                      key={l.id}
                      style={{ borderTop: `1px solid ${colors.divider}`, cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.03))")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                      onClick={() => selectItem({ type: "lancamento", tipoLanc: "ENTRADA", id: l.id, valor: l.valor, descricao: l.descricao, data: l.data, categoria: l.categoria, origem: l.origem })}
                    >
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, fontWeight: 500 }}>{l.descricao}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 6, fontSize: typography.fontSize.xs, fontWeight: 600 }}>{CATEGORIAS.find(c => c.value === l.categoria)?.label ?? l.categoria}</span></td>
                      <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{l.origem}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: colors.success }}>R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <button onClick={e => { e.stopPropagation(); setIdExcluir(l.id); }} style={{ color: colors.danger, background: "none", border: "none", cursor: "pointer", fontSize: typography.fontSize.xs, fontWeight: 600 }}>Excluir</button>
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
