import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "../../../core/types/app.types";
import {
  listarAuditoria,
  TABELAS_LABEL,
  ACAO_COR,
  type RegistroAuditoria,
} from "../../../core/services/auditoria.service";
import { getDb } from "../../../core/database";

interface Props {
  usuario: Usuario;
}

export function AuditoriaPage({ usuario }: Props) {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: number; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroTabela, setFiltroTabela] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await listarAuditoria({
        usuario_id: filtroUsuario ? Number(filtroUsuario) : undefined,
        tabela: filtroTabela || undefined,
        dataInicio: filtroInicio || undefined,
        dataFim: filtroFim || undefined,
        limite: 500,
      });
      setRegistros(dados);
    } finally {
      setCarregando(false);
    }
  }, [filtroUsuario, filtroTabela, filtroInicio, filtroFim]);

  useEffect(() => {
    carregar();
    getDb().then(db =>
      db.select<{ id: number; nome: string }[]>("SELECT id, nome FROM usuarios ORDER BY nome")
    ).then(setUsuarios).catch(() => {});
  }, [carregar]);

  function formatarData(iso: string) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch { return iso; }
  }

  const thStyle = {
    padding: "10px 14px", textAlign: "left" as const,
    fontSize: 11, color: "#667085", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.05em",
    background: "#f8fafc",
  };

  const tdStyle = { padding: "11px 14px", fontSize: 13, borderTop: "1px solid #f0f0f0" };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#1a1d2e" }}>🔍 Auditoria do Sistema</h2>
        <p style={{ margin: "0 0 20px", color: "#667085", fontSize: 14 }}>
          Histórico de inclusões, alterações e exclusões registradas.
        </p>

        {/* Filtros */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#667085", marginBottom: 4, textTransform: "uppercase" }}>Usuário</label>
            <select
              value={filtroUsuario}
              onChange={e => setFiltroUsuario(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d6dbe7", fontSize: 13 }}
            >
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#667085", marginBottom: 4, textTransform: "uppercase" }}>Módulo</label>
            <select
              value={filtroTabela}
              onChange={e => setFiltroTabela(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d6dbe7", fontSize: 13 }}
            >
              <option value="">Todos</option>
              {Object.entries(TABELAS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#667085", marginBottom: 4, textTransform: "uppercase" }}>De</label>
            <input
              type="date"
              value={filtroInicio}
              onChange={e => setFiltroInicio(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d6dbe7", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#667085", marginBottom: 4, textTransform: "uppercase" }}>Até</label>
            <input
              type="date"
              value={filtroFim}
              onChange={e => setFiltroFim(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d6dbe7", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={carregar}
              disabled={carregando}
              style={{ width: "100%", padding: "9px 16px", background: "#1f3b73", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              {carregando ? "Filtrando..." : "Filtrar"}
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ borderRadius: 12, border: "1px solid #e4e7ec", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Data/Hora</th>
                <th style={thStyle}>Usuário</th>
                <th style={thStyle}>Ação</th>
                <th style={thStyle}>Módulo</th>
                <th style={thStyle}>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#667085", padding: "32px" }}>
                    {carregando ? "Carregando..." : "Nenhum registro encontrado."}
                  </td>
                </tr>
              ) : registros.map(r => {
                const cor = ACAO_COR[r.acao as keyof typeof ACAO_COR] ?? { bg: "#f3f4f6", text: "#374151" };
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, color: "#667085", whiteSpace: "nowrap" }}>{formatarData(r.data_hora)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.usuario_nome ?? `#${r.usuario_id}`}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: cor.bg, color: cor.text }}>
                        {r.acao}
                      </span>
                    </td>
                    <td style={tdStyle}>{TABELAS_LABEL[r.tabela] ?? r.tabela}</td>
                    <td style={{ ...tdStyle, color: "#344054" }}>{r.descricao}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {registros.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#98a2b3" }}>
            {registros.length} registro(s) exibido(s) — máximo 500 por consulta.
          </p>
        )}
      </section>
    </div>
  );
}
