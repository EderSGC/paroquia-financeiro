import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "@core/database";
import { EXPECTED_SCHEMA } from "@core/database/schema";
import { registrarAuditoria } from "./auditoria.service";
import { logger } from "@core/utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncExportOptions {
  comunidadeId?: number | null;
  tabelas: string[];
  usuarioId?: number;
}

export interface SyncPackage {
  versao: string;
  exportadoEm: string;
  comunidade?: string;
  tabelas: Record<string, Record<string, unknown>[]>;
  totalRegistros: number;
}

export interface SyncImportResult {
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
  detalhes: { tabela: string; inseridos: number; atualizados: number }[];
}

const SYNC_VERSION = "1.0";

function normalizeTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  return ts.replace(" ", "T");
}

const TABELAS_SINCRONIZAVEIS = [
  "fieis",
  "familias",
  "membros_familia",
  "comunidades",
  "sacramentos_registros",
  "obitos_exequias",
  "pastorais",
  "grupos",
  "grupo_membros",
  "catequese_turmas",
  "catequistas",
  "catequese_fichas",
  "catequese_matriculas",
  "catequese_encontros",
  "catequese_presencas",
  "observacoes_pastorais",
  "lancamentos",
  "caixa_fechamento",
];

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export function getTabelasSincronizaveis(): { nome: string; label: string }[] {
  const labels: Record<string, string> = {
    fieis: "Fiéis / Cadastro de Pessoas",
    familias: "Famílias",
    membros_familia: "Membros de Família",
    comunidades: "Comunidades",
    sacramentos_registros: "Sacramentos (Batismo, Crisma, etc.)",
    obitos_exequias: "Óbitos e Exéquias",
    pastorais: "Pastorais",
    grupos: "Grupos e Movimentos",
    grupo_membros: "Membros de Grupos",
    catequese_turmas: "Turmas de Catequese",
    catequistas: "Catequistas",
    catequese_fichas: "Fichas de Catequese",
    catequese_matriculas: "Matrículas de Catequese",
    catequese_encontros: "Encontros de Catequese",
    catequese_presencas: "Presenças de Catequese",
    observacoes_pastorais: "Observações Pastorais",
    lancamentos: "Financeiro — Lançamentos (Livro Caixa)",
    caixa_fechamento: "Financeiro — Fechamentos de Caixa (Conferência Física)",
  };
  return TABELAS_SINCRONIZAVEIS.map(nome => ({ nome, label: labels[nome] || nome }));
}

export async function exportarRegistros(opts: SyncExportOptions): Promise<string> {
  const db = await getDb();
  const tabelasExportar = opts.tabelas.filter(t => TABELAS_SINCRONIZAVEIS.includes(t));

  if (tabelasExportar.length === 0) {
    throw new Error("Nenhuma tabela selecionada para exportação.");
  }

  let comunidadeNome: string | undefined;
  if (opts.comunidadeId) {
    const rows = await db.select<{ nome: string }[]>(
      "SELECT nome FROM comunidades WHERE id = ?", [opts.comunidadeId]
    );
    comunidadeNome = rows[0]?.nome;
  }

  const tabelas: Record<string, Record<string, unknown>[]> = {};
  let totalRegistros = 0;

  for (const tabela of tabelasExportar) {
    const schema = EXPECTED_SCHEMA.find(s => s.name === tabela);
    if (!schema) continue;

    const hasComunidadeId = schema.columns.some(c => c.name === "comunidade_id");
    const hasComunidade = schema.columns.some(c => c.name === "comunidade");
    // Tabelas do financeiro guardam a comunidade pelo nome em colunas próprias:
    // lancamentos.origem e caixa_fechamento.unidade
    const hasOrigem = schema.columns.some(c => c.name === "origem");
    const hasUnidade = schema.columns.some(c => c.name === "unidade");
    const hasDeletedAt = schema.columns.some(c => c.name === "deleted_at");

    let sql = `SELECT * FROM "${tabela}" WHERE 1=1`;
    const params: unknown[] = [];

    if (hasDeletedAt) {
      sql += " AND deleted_at IS NULL";
    }

    if (opts.comunidadeId && hasComunidadeId) {
      sql += " AND comunidade_id = ?";
      params.push(opts.comunidadeId);
    } else if (opts.comunidadeId && comunidadeNome && hasComunidade) {
      sql += " AND comunidade = ?";
      params.push(comunidadeNome);
    } else if (opts.comunidadeId && comunidadeNome && hasOrigem) {
      sql += " AND origem = ?";
      params.push(comunidadeNome);
    } else if (opts.comunidadeId && comunidadeNome && hasUnidade) {
      sql += " AND unidade = ?";
      params.push(comunidadeNome);
    }

    const rows = await db.select<Record<string, unknown>[]>(sql, params);
    if (rows.length > 0) {
      tabelas[tabela] = rows;
      totalRegistros += rows.length;
    }
  }

  if (totalRegistros === 0) {
    throw new Error("Nenhum registro encontrado para exportação com os filtros selecionados.");
  }

  const pacote: SyncPackage = {
    versao: SYNC_VERSION,
    exportadoEm: new Date().toISOString(),
    comunidade: comunidadeNome,
    tabelas,
    totalRegistros,
  };

  const sufixo = comunidadeNome
    ? comunidadeNome.replace(/[^a-zA-Z0-9À-ÿ]/g, "_").substring(0, 30)
    : "todos";
  const data = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const nomeArquivo = `registros-${sufixo}-${data.getFullYear()}${pad(data.getMonth() + 1)}${pad(data.getDate())}.json`;

  const destino = await save({
    defaultPath: nomeArquivo,
    filters: [{ name: "Registros do Financeiro Paroquial", extensions: ["json"] }],
  });

  if (!destino) throw new Error("CANCELLED");

  await writeTextFile(destino, JSON.stringify(pacote, null, 2));

  if (opts.usuarioId) {
    await registrarAuditoria({
      usuario_id: opts.usuarioId,
      acao: "EXPORTACAO",
      tabela: "sistema",
      descricao: `Exportação de ${totalRegistros} registros (${tabelasExportar.join(", ")})${comunidadeNome ? ` — Comunidade: ${comunidadeNome}` : ""}`,
    });
  }

  logger.log(`[Sync] Exportados ${totalRegistros} registros para ${destino}`);
  return destino;
}

// ─────────────────────────────────────────────────────────────────────────────
// Import (merge)
// ─────────────────────────────────────────────────────────────────────────────

export async function importarRegistros(usuarioId?: number): Promise<SyncImportResult> {
  const arquivo = await open({
    title: "Selecionar arquivo de registros",
    filters: [{ name: "Registros do Financeiro Paroquial", extensions: ["json"] }],
  });

  if (!arquivo || typeof arquivo !== "string") throw new Error("CANCELLED");

  const conteudo = await readTextFile(arquivo);
  let pacote: SyncPackage;

  try {
    pacote = JSON.parse(conteudo);
  } catch {
    throw new Error("O arquivo selecionado não é um JSON válido.");
  }

  if (!pacote.versao || !pacote.tabelas) {
    throw new Error("O arquivo não é um pacote de registros válido do Financeiro Paroquial.");
  }

  const db = await getDb();
  const result: SyncImportResult = {
    inseridos: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
    detalhes: [],
  };

  await db.execute("SAVEPOINT sync_import");
  let rollback = true;

  try {
    for (const [tabela, registros] of Object.entries(pacote.tabelas)) {
      if (!TABELAS_SINCRONIZAVEIS.includes(tabela)) {
        result.erros.push(`Tabela "${tabela}" não é sincronizável — ignorada.`);
        continue;
      }

      const schema = EXPECTED_SCHEMA.find(s => s.name === tabela);
      if (!schema) continue;

      let colunasSchema = schema.columns.map(c => c.name);
      // fiel_id é um id local de cada instalação — importado, apontaria para o
      // fiel errado. O nome do fiel já viaja em "descricao", então descartamos.
      if (tabela === "lancamentos") {
        colunasSchema = colunasSchema.filter(c => c !== "fiel_id");
      }
      const hasUuid = colunasSchema.includes("uuid");
      let inseridos = 0;
      let atualizados = 0;

      for (const registro of registros) {
        try {
          if (hasUuid && registro.uuid) {
            const existente = await db.select<Record<string, unknown>[]>(
              `SELECT id, updated_at FROM "${tabela}" WHERE uuid = ?`,
              [registro.uuid]
            );

            if (existente.length > 0) {
              const existenteUpdated = normalizeTimestamp(existente[0].updated_at as string | null);
              const registroUpdated = normalizeTimestamp(registro.updated_at as string | null);

              if (registroUpdated && existenteUpdated && registroUpdated > existenteUpdated) {
                const colunas = Object.keys(registro).filter(
                  k => k !== "id" && colunasSchema.includes(k)
                );
                const sets = colunas.map(c => `"${c}" = ?`).join(", ");
                const valores: unknown[] = colunas.map(c => registro[c] ?? null);
                valores.push(existente[0].id);

                await db.execute(
                  `UPDATE "${tabela}" SET ${sets} WHERE id = ?`,
                  valores
                );
                atualizados++;
              }
            } else {
              const colunas = Object.keys(registro).filter(
                k => k !== "id" && colunasSchema.includes(k)
              );
              const placeholders = colunas.map(() => "?").join(", ");
              const valores = colunas.map(c => registro[c] ?? null);

              await db.execute(
                `INSERT INTO "${tabela}" (${colunas.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
                valores
              );
              inseridos++;
            }
          } else {
            result.ignorados++;
          }
        } catch (err) {
          result.erros.push(`[${tabela}] Erro no registro uuid=${registro.uuid}: ${String(err)}`);
        }
      }

      result.inseridos += inseridos;
      result.atualizados += atualizados;
      result.detalhes.push({ tabela, inseridos, atualizados });
    }

    await db.execute("RELEASE SAVEPOINT sync_import");
    rollback = false;
  } finally {
    if (rollback) {
      try { await db.execute("ROLLBACK TO SAVEPOINT sync_import"); } catch { /* ok */ }
    }
  }

  if (usuarioId) {
    await registrarAuditoria({
      usuario_id: usuarioId,
      acao: "IMPORTACAO",
      tabela: "sistema",
      descricao: `Importação: ${result.inseridos} novos, ${result.atualizados} atualizados${pacote.comunidade ? ` — Origem: ${pacote.comunidade}` : ""} (arquivo: ${arquivo})`,
    });
  }

  logger.log(`[Sync] Importação concluída: ${result.inseridos} inseridos, ${result.atualizados} atualizados, ${result.erros.length} erros`);
  return result;
}
