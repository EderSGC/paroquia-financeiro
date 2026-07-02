import Database from "@tauri-apps/plugin-sql";
import { logger } from "@core/utils/logger";

import { EXPECTED_SCHEMA } from "./schema";
import {
  getTableInfo,
  createTableFromSchema,
  addMissingColumns,
} from "./migration";

export async function validateAndSyncSchema(
  db: Database
): Promise<void> {
  logger.log(
    "🔍 Iniciando validação e sincronização de schema..."
  );

  const report: {
    table: string;
    created: boolean;
    columnsAdded: string[];
  }[] = [];

  for (const tableSchema of EXPECTED_SCHEMA) {
    const tableInfo = await getTableInfo(
      db,
      tableSchema.name
    );

    if (Object.keys(tableInfo).length === 0) {
      await createTableFromSchema(
        db,
        tableSchema
      );

      report.push({
        table: tableSchema.name,
        created: true,
        columnsAdded: [],
      });

      continue;
    }

    const columnsAdded =
      await addMissingColumns(
        db,
        tableSchema
      );

    report.push({
      table: tableSchema.name,
      created: false,
      columnsAdded,
    });
  }

  logger.log("\n============================================================");
  logger.log("📊 RELATÓRIO DE MIGRAÇÃO DE SCHEMA");
  logger.log("============================================================");

  report.forEach((item) => {
    if (item.created) {
      logger.log(
        `✅ [CRIADA] Tabela '${item.table}'`
      );
    } else if (item.columnsAdded.length > 0) {
      logger.log(
        `✅ [ATUALIZADA] Tabela '${item.table}' - Colunas adicionadas: ${item.columnsAdded.join(", ")}`
      );
    } else {
      logger.log(
        `✅ [OK] Tabela '${item.table}' - Nenhuma alteração necessária`
      );
    }
  });

  logger.log("============================================================");
  logger.log("✅ Schema sincronizado com sucesso!");
  logger.log("============================================================\n");
}