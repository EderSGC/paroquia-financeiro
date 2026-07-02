import Database from "@tauri-apps/plugin-sql";
import { logger } from "@core/utils/logger";

/**
 * Tabelas que têm coluna updated_at e devem tê-la mantida automaticamente.
 * A auditoria é omitida intencionalmente — é append-only e não tem updated_at.
 */
const TABLES_WITH_UPDATED_AT = [
  "fieis", "comunidades", "usuarios", "lancamentos",
  "patrimonio_bens", "patrimonio_manutencoes", "familias",
  "membros_familia", "catequese_turmas", "catequese_matriculas",
  "catequistas", "catequese_presencas", "obitos_exequias",
  "agenda_compromissos", "paroquia", "catequese_fichas",
  "catequese_encontros", "pastorais", "grupos", "contas",
  "sacramentos_registros", "documentos_registros",
  "caixa_fechamento", "configuracoes_partilha",
];

/**
 * Cria triggers AFTER UPDATE que atualizam automaticamente updated_at.
 *
 * Padrão:
 *   WHEN NEW.updated_at IS OLD.updated_at
 *   → só dispara se updated_at NÃO foi alterado explicitamente pelo app.
 *   → se o sync precisar definir um updated_at específico, ele não será sobrescrito.
 *
 * SQLite não executa triggers recursivamente por padrão (RECURSIVE_TRIGGERS = OFF),
 * então a UPDATE dentro do trigger não gera loop infinito.
 */
export async function createUpdatedAtTriggers(db: Database): Promise<void> {
  let ok = 0, skip = 0;
  for (const table of TABLES_WITH_UPDATED_AT) {
    try {
      // Verifica se updated_at existe na tabela antes de criar/recriar o trigger.
      // Triggers obsoletos (referenciando coluna inexistente) são removidos primeiro.
      const cols = await db.select<{ name: string }[]>(
        `PRAGMA table_info("${table}")`
      ).catch(() => [] as { name: string }[]);

      const hasUpdatedAt = cols.some(c => c.name === "updated_at");

      // Remove trigger possivelmente obsoleto (coluna pode ter sido removida ou a tabela
      // foi recriada sem ela em uma versão anterior do app).
      await db.execute(`DROP TRIGGER IF EXISTS trg_${table}_updated_at`).catch(() => {});

      if (!hasUpdatedAt) {
        skip++;
        continue;
      }

      await db.execute(`
        CREATE TRIGGER trg_${table}_updated_at
        AFTER UPDATE ON ${table}
        FOR EACH ROW
        WHEN NEW.updated_at IS OLD.updated_at
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);
      ok++;
    } catch { skip++; }
  }
  logger.log(`✅ Triggers updated_at: ${ok} criadas, ${skip} ignoradas (coluna ausente)`);
}

/**
 * Remove triggers de updated_at (utilitário para testes/manutenção).
 * NÃO chamado durante a inicialização normal.
 */
export async function dropUpdatedAtTriggers(db: Database): Promise<void> {
  for (const table of TABLES_WITH_UPDATED_AT) {
    await db.execute(`DROP TRIGGER IF EXISTS trg_${table}_updated_at`).catch(() => {});
  }
}
