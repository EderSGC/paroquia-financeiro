// src/modules/financeiro/components/Dizimo.tsx
import React, { useEffect, useState, useCallback } from "react";
import { getDb } from "@core/database";
import { carregarPartilha } from "../../auth/services/auth.service";
import { FielService } from "@core/services/fiel.service";
import { ModalConfirm, ModalAlert } from "../../../core/ui/Modal";
import { colors, spacing, typography } from "../../../design";

interface Dizimista { id: number; nome: string; telefone: string; comunidade: string; valor_mensal: number; ativo: number; }

const inS: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, width: "100%", fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, boxSizing: "border-box", background: colors.surface, color: colors.text };

export const Dizimo: React.FC = () => {
  const [lista, setLista] = useState<Dizimista[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [comunidade, setComunidade] = useState("PAROQUIA");
  const [valorMensal, setValorMensal] = useState("");
  const [comunidades, setComunidades] = useState<{ id: number; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [idExcluir, setIdExcluir] = useState<number | null>(null);
  const [alerta, setAlerta] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);
  const [saldoCaixa, setSaldoCaixa] = useState(0);
  const [entradasTotal, setEntradasTotal] = useState(0);
  const [saidasTotal, setSaidasTotal] = useState(0);
  const [pctPartilha, setPctPartilha] = useState({ comunidade: 30, areaMissionaria: 40, arquidiocese: 29, fundoMissionario: 1 });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const db = await getDb();
      const r = await db.select<Dizimista[]>(
        "SELECT id, nome, telefone, comunidade, 0 as valor_mensal, 1 as ativo FROM fieis WHERE deleted_at IS NULL AND isDizimista=1 ORDER BY nome ASC"
      );
      setLista(r);
      const cs = await db.select<{ id: number; nome: string }[]>("SELECT id, nome FROM comunidades WHERE deleted_at IS NULL ORDER BY nome");
      setComunidades(cs);
      const cfg = await carregarPartilha();
      setPctPartilha(cfg);
      // Calcula saldo final do caixa (entradas − saídas) para base da partilha
      const res = await db.select<{ entradas: number; saidas: number }[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
          COALESCE(SUM(CASE WHEN tipo='SAIDA'   THEN valor ELSE 0 END), 0) AS saidas
        FROM lancamentos WHERE deleted_at IS NULL
      `);
      const e = res[0]?.entradas ?? 0;
      const s = res[0]?.saidas ?? 0;
      setEntradasTotal(e);
      setSaidasTotal(s);
      setSaldoCaixa(Math.max(0, e - s));
    } catch (e) { console.error(e); } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    try {
      const { id, created } = await FielService.findOrCreate({
        nome: nome.trim(),
        telefone: telefone.trim(),
        comunidade,
        isDizimista: true,
      });
      if (!created) {
        const db = await getDb();
        await db.execute("UPDATE fieis SET isDizimista=1 WHERE id=?", [id]);
      }
      setNome(""); setTelefone(""); setValorMensal("");
      await carregar();
      setAlerta({ tipo: "sucesso", msg: created ? "Dizimista cadastrado!" : "Fiel existente marcado como dizimista." });
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao cadastrar dizimista." }); }
  };

  const alternarAtivo = async (id: number, ativo: number) => {
    try {
      const db = await getDb();
      await db.execute("UPDATE fieis SET isDizimista=? WHERE id=?", [ativo === 1 ? 0 : 1, id]);
      await carregar();
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao atualizar." }); }
  };

  const confirmarExcluir = async () => {
    if (!idExcluir) return;
    try {
      const db = await getDb();
      await db.execute("UPDATE fieis SET isDizimista=0 WHERE id=?", [idExcluir]);
      await carregar();
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao remover." }); }
    setIdExcluir(null);
  };

  const filtrados = lista.filter(d => d.nome.toLowerCase().includes(busca.toLowerCase()));

  const partilha = {
    comunidade:       saldoCaixa * (pctPartilha.comunidade       / 100),
    areaMissionaria:  saldoCaixa * (pctPartilha.areaMissionaria  / 100),
    arquidiocese:     saldoCaixa * (pctPartilha.arquidiocese     / 100),
    fundoMissionario: saldoCaixa * (pctPartilha.fundoMissionario / 100),
  };

  return (
    <div>
      <ModalConfirm aberto={idExcluir !== null} titulo="Remover Dizimista" mensagem="Deseja remover este fiel da lista de dizimistas?" textoBotaoOk="Remover" onConfirmar={confirmarExcluir} onCancelar={() => setIdExcluir(null)} />
      <ModalAlert aberto={!!alerta} tipo={alerta?.tipo ?? "info"} mensagem={alerta?.msg ?? ""} onFechar={() => setAlerta(null)} />

      {/* Resumo do caixa — sempre visível */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: spacing.md, marginBottom: spacing.md }}>
        {[
          { label: "Total Dizimistas Ativos", valor: `${lista.length}`, cor: colors.primary, prefix: "" },
          { label: "Total Entradas", valor: entradasTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), cor: "#16a34a", prefix: "R$ " },
          { label: "Total Saídas", valor: saidasTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), cor: "#dc2626", prefix: "R$ " },
          { label: "Saldo Final do Caixa", valor: saldoCaixa.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), cor: "#1d4ed8", prefix: "R$ " },
        ].map(card => (
          <div key={card.label} style={{ background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, padding: spacing.lg }}>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: card.cor }}>{card.prefix}{card.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: spacing.lg, alignItems: "flex-start" }}>
        <div style={{ width: 300, background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, padding: spacing.lg, flexShrink: 0 }}>
          <h3 style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.sm, fontWeight: 700, color: colors.primary }}>+ Novo Dizimista</h3>
          <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Nome Completo *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do fiel" style={inS} required />
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Telefone</label>
            <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" style={inS} />
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Comunidade</label>
            <select value={comunidade} onChange={e => setComunidade(e.target.value)} style={inS}>
              <option value="PAROQUIA">Matriz Paroquial</option>
              {comunidades.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
            <label style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textSecondary }}>Contribuição Mensal (R$)</label>
            <input type="text" value={valorMensal} onChange={e => setValorMensal(e.target.value)} placeholder="Opcional" style={inS} />
            <button type="submit" style={{ marginTop: 4, padding: "10px", background: colors.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: typography.fontFamily }}>
              Cadastrar Dizimista
            </button>
          </form>
        </div>

        <div style={{ flex: 1, background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: `1px solid ${colors.divider}`, display: "flex", gap: spacing.md, alignItems: "center" }}>
            <input type="text" placeholder="🔍 Buscar dizimista..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inS, flex: 1 }} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: 700, color: colors.primary, flexShrink: 0 }}>{filtrados.length} dizimistas</span>
          </div>
          {carregando ? <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Carregando...</div> : filtrados.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textMuted }}>Nenhum dizimista encontrado.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: colors.surfaceSoft }}>
                {["Nome","Telefone","Comunidade","Status","Ação"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtrados.map(d => (
                  <tr key={d.id} style={{ borderTop: `1px solid ${colors.divider}`, opacity: d.ativo ? 1 : 0.5 }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: typography.fontSize.sm }}>{d.nome}</td>
                    <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{d.telefone || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{d.comunidade || "Matriz"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: d.ativo ? "#d1fae5" : "#f3f4f6", color: d.ativo ? "#065f46" : "#6b7280", padding: "2px 8px", borderRadius: 6, fontSize: typography.fontSize.xs, fontWeight: 600 }}>
                        {d.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => alternarAtivo(d.id, d.ativo)} style={{ color: colors.primary, background: "none", border: "none", cursor: "pointer", fontSize: typography.fontSize.xs, fontWeight: 600 }}>
                          {d.ativo ? "Inativar" : "Ativar"}
                        </button>
                        <button onClick={() => setIdExcluir(d.id)} style={{ color: colors.danger, background: "none", border: "none", cursor: "pointer", fontSize: typography.fontSize.xs, fontWeight: 600 }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
