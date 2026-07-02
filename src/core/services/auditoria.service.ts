import { getDb } from "../database";

export type AcaoAuditoria = "INCLUSAO" | "ALTERACAO" | "EXCLUSAO" | "LOGIN" | "LOGOUT" | "BACKUP" | "RESTAURACAO" | "EXPORTACAO" | "IMPORTACAO";

export interface EntradaAuditoria {
  usuario_id: number;
  acao: AcaoAuditoria;
  tabela: string;
  registro_id?: number | null;
  descricao: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
}

export interface RegistroAuditoria extends EntradaAuditoria {
  id: number;
  usuario_nome?: string;
  data_hora: string;
}

export interface FiltrosAuditoria {
  usuario_id?: number;
  tabela?: string;
  acao?: AcaoAuditoria;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
}

export async function registrarAuditoria(entrada: EntradaAuditoria): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      `INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, descricao, valor_anterior, valor_novo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entrada.usuario_id,
        entrada.acao,
        entrada.tabela,
        entrada.registro_id ?? null,
        entrada.descricao,
        entrada.valor_anterior ?? null,
        entrada.valor_novo ?? null,
      ],
    );
  } catch (err) {
    console.warn("[Auditoria] Falha ao registrar entrada:", err);
  }
}

export async function registrarAlteracao(
  usuario_id: number,
  tabela: string,
  registro_id: number,
  descricao: string,
  anterior: Record<string, unknown>,
  novo: Record<string, unknown>,
): Promise<void> {
  const diff: Record<string, { de: unknown; para: unknown }> = {};
  for (const key of Object.keys(novo)) {
    if (key === "updated_at" || key === "created_at") continue;
    if (JSON.stringify(anterior[key]) !== JSON.stringify(novo[key])) {
      diff[key] = { de: anterior[key], para: novo[key] };
    }
  }
  if (Object.keys(diff).length === 0) return;

  await registrarAuditoria({
    usuario_id,
    acao: "ALTERACAO",
    tabela,
    registro_id,
    descricao,
    valor_anterior: JSON.stringify(diff),
    valor_novo: null,
  });
}

export async function capturarEstadoAtual(tabela: string, registroId: number): Promise<Record<string, unknown> | null> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM "${tabela}" WHERE id = ?`,
      [registroId]
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listarAuditoria(filtros?: FiltrosAuditoria): Promise<RegistroAuditoria[]> {
  const db = await getDb();

  const conds: string[] = [];
  const params: unknown[] = [];

  if (filtros?.usuario_id) {
    conds.push("a.usuario_id = ?");
    params.push(filtros.usuario_id);
  }
  if (filtros?.tabela) {
    conds.push("a.tabela = ?");
    params.push(filtros.tabela);
  }
  if (filtros?.acao) {
    conds.push("a.acao = ?");
    params.push(filtros.acao);
  }
  if (filtros?.dataInicio) {
    conds.push("DATE(a.data_hora) >= ?");
    params.push(filtros.dataInicio);
  }
  if (filtros?.dataFim) {
    conds.push("DATE(a.data_hora) <= ?");
    params.push(filtros.dataFim);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limite = filtros?.limite ?? 500;

  return db.select<RegistroAuditoria[]>(
    `SELECT a.*, u.nome AS usuario_nome
     FROM auditoria a
     LEFT JOIN usuarios u ON a.usuario_id = u.id
     ${where}
     ORDER BY a.data_hora DESC
     LIMIT ${limite}`,
    params,
  );
}

export async function contarAuditoria(filtros?: FiltrosAuditoria): Promise<number> {
  const db = await getDb();
  const conds: string[] = [];
  const params: unknown[] = [];

  if (filtros?.tabela) { conds.push("tabela = ?"); params.push(filtros.tabela); }
  if (filtros?.acao) { conds.push("acao = ?"); params.push(filtros.acao); }
  if (filtros?.dataInicio) { conds.push("DATE(data_hora) >= ?"); params.push(filtros.dataInicio); }
  if (filtros?.dataFim) { conds.push("DATE(data_hora) <= ?"); params.push(filtros.dataFim); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await db.select<{ n: number }[]>(`SELECT COUNT(*) as n FROM auditoria ${where}`, params);
  return rows[0]?.n ?? 0;
}

export const TABELAS_LABEL: Record<string, string> = {
  fieis:                 "Fiéis",
  comunidades:           "Comunidades",
  sacramentos_registros: "Sacramentos",
  lancamentos:           "Financeiro",
  patrimonio_bens:       "Patrimônio",
  usuarios:              "Usuários",
  agenda_compromissos:   "Agenda",
  catequese_turmas:      "Catequese — Turmas",
  catequese_matriculas:  "Catequese — Matrículas",
  catequistas:           "Catequistas",
  familias:              "Famílias",
  membros_familia:       "Membros de Família",
  grupos:                "Grupos",
  pastorais:             "Pastorais",
  contas:                "Contas",
  documentos_registros:  "Documentos",
  patrimonio_manutencoes:"Manutenções",
  obitos_exequias:       "Óbitos/Exéquias",
  observacoes_pastorais: "Observações Pastorais",
  configuracoes_partilha:"Configuração de Partilha",
  sistema:               "Sistema",
};

export const ACAO_LABEL: Record<AcaoAuditoria, string> = {
  INCLUSAO:    "Inclusão",
  ALTERACAO:   "Alteração",
  EXCLUSAO:    "Exclusão",
  LOGIN:       "Login",
  LOGOUT:      "Logout",
  BACKUP:      "Backup",
  RESTAURACAO: "Restauração",
  EXPORTACAO:  "Exportação",
  IMPORTACAO:  "Importação",
};

export const ACAO_COR: Record<AcaoAuditoria, { bg: string; text: string }> = {
  INCLUSAO:    { bg: "#d1fae5", text: "#065f46" },
  ALTERACAO:   { bg: "#fef3c7", text: "#92400e" },
  EXCLUSAO:    { bg: "#fee2e2", text: "#991b1b" },
  LOGIN:       { bg: "#dbeafe", text: "#1e40af" },
  LOGOUT:      { bg: "#e0e7ff", text: "#3730a3" },
  BACKUP:      { bg: "#f3e8ff", text: "#6b21a8" },
  RESTAURACAO: { bg: "#fce7f3", text: "#9d174d" },
  EXPORTACAO:  { bg: "#e0f2fe", text: "#075985" },
  IMPORTACAO:  { bg: "#ecfdf5", text: "#064e3b" },
};
