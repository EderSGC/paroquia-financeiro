// src/core/database/connection.ts

import Database from "@tauri-apps/plugin-sql";

export const connection = {
  dbInstance: null as Database | null,
  isConnecting: false,
  connectionError: null as string | null,
};