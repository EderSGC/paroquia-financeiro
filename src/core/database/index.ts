// src/core/database/index.ts

import Database from "@tauri-apps/plugin-sql";
import { logger } from "@core/utils/logger";

import { DATABASE } from "@core/config/constants";

import { connection } from "./connection";

import { validateAndSyncSchema } from "./migration";
import { runMigrations } from "./migrations";
import { prepareForSync } from "./syncPreparation";
import { createIndexes } from "./indexes";
import { createUpdatedAtTriggers } from "./triggers";
import { createForeignKeys } from "./foreignKeys";

export * from "./types";
export * from "./schema";
export * from "./migration";
export * from "./connection";
export * from "./syncPreparation";

let connectionPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (connection.dbInstance) {
    return connection.dbInstance;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = initDb();

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

async function initDb(): Promise<Database> {
  connection.isConnecting = true;
  connection.connectionError = null;

  try {
    connection.dbInstance =
      await Database.load(
        `sqlite:${DATABASE.NAME}`
      );

    await connection.dbInstance.execute("PRAGMA foreign_keys = ON");
    await connection.dbInstance.execute("PRAGMA journal_mode = WAL");
    await connection.dbInstance.execute("PRAGMA synchronous = FULL");
    await connection.dbInstance.execute("PRAGMA cache_size = -8000");

    await validateAndSyncSchema(connection.dbInstance);
    await runMigrations(connection.dbInstance);
    await prepareForSync(connection.dbInstance);
    await createIndexes(connection.dbInstance);
    await createUpdatedAtTriggers(connection.dbInstance);
    await createForeignKeys(connection.dbInstance);

    const db = connection.dbInstance;
    window.addEventListener("beforeunload", () => {
      db.execute("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => {});
    });

    logger.log("✅ Banco sincronizado com sucesso.");

    return db;
  } catch (error) {
    connection.dbInstance = null;
    connection.connectionError = String(error);
    console.error("❌ Erro ao conectar banco:", error);
    throw error;
  } finally {
    connection.isConnecting = false;
  }
}