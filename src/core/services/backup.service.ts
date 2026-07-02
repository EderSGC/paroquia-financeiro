import { save, open, confirm } from "@tauri-apps/plugin-dialog";
import { copyFile, readFile, stat, mkdir, readDir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { DATABASE, BACKUP } from "../config/constants";
import { connection } from "../database/connection";
import { logger } from "@core/utils/logger";
import { registrarAuditoria } from "./auditoria.service";

export interface BackupInfo {
  lastBackupDate: string | null;
  lastBackupPath: string | null;
  lastBackupSize: number | null;
}

export interface BackupConfig {
  pastaCloud: string | null;
  intervaloMs: number;
  manter: number;
}

const BACKUP_KEY = "paroquia_last_backup";
const CONFIG_KEY = "paroquia_backup_config";
let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

export function getBackupInfo(): BackupInfo {
  try {
    const stored = localStorage.getItem(BACKUP_KEY);
    if (!stored) return { lastBackupDate: null, lastBackupPath: null, lastBackupSize: null };
    return JSON.parse(stored);
  } catch {
    return { lastBackupDate: null, lastBackupPath: null, lastBackupSize: null };
  }
}

function saveBackupInfo(info: BackupInfo) {
  localStorage.setItem(BACKUP_KEY, JSON.stringify(info));
}

export function getBackupConfig(): BackupConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return { pastaCloud: null, intervaloMs: BACKUP.AUTO_BACKUP_INTERVAL_MS, manter: BACKUP.KEEP_LAST_FILES };
    return JSON.parse(stored);
  } catch {
    return { pastaCloud: null, intervaloMs: BACKUP.AUTO_BACKUP_INTERVAL_MS, manter: BACKUP.KEEP_LAST_FILES };
  }
}

export function saveBackupConfig(config: BackupConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  iniciarBackupAutomatico();
}

function gerarNomeArquivo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `paroquia-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.db`;
}

async function getDbPath(): Promise<string> {
  const appData = await appDataDir();
  return join(appData, DATABASE.NAME);
}

async function executarCheckpoint(): Promise<void> {
  if (connection.dbInstance) {
    try { await connection.dbInstance.execute("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* ok */ }
  }
}

export async function fazerBackup(usuarioId?: number): Promise<string> {
  const nomeArquivo = gerarNomeArquivo();

  const destino = await save({
    defaultPath: nomeArquivo,
    filters: [{ name: "Banco de Dados SQLite", extensions: ["db"] }],
  });

  if (!destino) throw new Error("CANCELLED");

  await executarCheckpoint();
  const dbPath = await getDbPath();
  await copyFile(dbPath, destino);

  let tamanho = 0;
  try { tamanho = (await stat(destino)).size; } catch { /* ok */ }

  saveBackupInfo({ lastBackupDate: new Date().toISOString(), lastBackupPath: destino, lastBackupSize: tamanho });

  if (usuarioId) {
    await registrarAuditoria({
      usuario_id: usuarioId, acao: "BACKUP", tabela: "sistema",
      descricao: `Backup manual: ${nomeArquivo} (${formatarTamanho(tamanho)})`,
    });
  }

  return destino;
}

export async function fazerBackupNaPasta(pasta: string, usuarioId?: number): Promise<string> {
  const nomeArquivo = gerarNomeArquivo();
  const destino = await join(pasta, nomeArquivo);

  await executarCheckpoint();
  const dbPath = await getDbPath();

  try { await mkdir(pasta, { recursive: true }); } catch { /* já existe */ }
  await copyFile(dbPath, destino);

  let tamanho = 0;
  try { tamanho = (await stat(destino)).size; } catch { /* ok */ }

  saveBackupInfo({ lastBackupDate: new Date().toISOString(), lastBackupPath: destino, lastBackupSize: tamanho });

  if (usuarioId) {
    await registrarAuditoria({
      usuario_id: usuarioId, acao: "BACKUP", tabela: "sistema",
      descricao: `Backup automático: ${nomeArquivo} (${formatarTamanho(tamanho)})`,
    });
  }

  await limparBackupsAntigos(pasta);

  return destino;
}

async function limparBackupsAntigos(pasta: string): Promise<void> {
  try {
    const config = getBackupConfig();
    const entries = await readDir(pasta);
    const backups = entries
      .filter(e => e.name?.startsWith("paroquia-backup-") && e.name?.endsWith(".db"))
      .map(e => e.name!)
      .sort()
      .reverse();

    if (backups.length <= config.manter) return;

    const { remove } = await import("@tauri-apps/plugin-fs");
    for (const nome of backups.slice(config.manter)) {
      const caminho = await join(pasta, nome);
      try { await remove(caminho); } catch { /* ok */ }
    }
  } catch { /* ok — pasta pode não existir ainda */ }
}

export function pararBackupAutomatico(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

export function iniciarBackupAutomatico(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }

  const config = getBackupConfig();
  if (!config.pastaCloud) return;

  autoBackupTimer = setInterval(async () => {
    try {
      const currentConfig = getBackupConfig();
      if (!currentConfig.pastaCloud) return;
      await fazerBackupNaPasta(currentConfig.pastaCloud);
      logger.log("[Backup] Backup automático concluído");
    } catch (e) {
      console.error("[Backup] Falha no backup automático:", e);
    }
  }, config.intervaloMs);
}

export async function configurarPastaCloud(usuarioId?: number): Promise<string | null> {
  const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
  const pasta = await openDialog({
    title: "Selecionar pasta para backups automáticos",
    directory: true,
  });

  if (!pasta || typeof pasta !== "string") return null;

  const config = getBackupConfig();
  config.pastaCloud = pasta;
  saveBackupConfig(config);

  await fazerBackupNaPasta(pasta, usuarioId);

  if (usuarioId) {
    await registrarAuditoria({
      usuario_id: usuarioId, acao: "BACKUP", tabela: "sistema",
      descricao: `Pasta de backup na nuvem configurada: ${pasta}`,
    });
  }

  return pasta;
}

export async function restaurarBackup(usuarioId?: number): Promise<void> {
  const arquivo = await open({
    title: "Selecionar Backup para Restaurar",
    filters: [{ name: "Backup do Financeiro Paroquial", extensions: ["db"] }],
  });

  if (!arquivo || typeof arquivo !== "string") throw new Error("CANCELLED");

  let tamanho = 0;
  try { tamanho = (await stat(arquivo)).size; } catch {
    throw new Error("Não foi possível ler o arquivo selecionado.");
  }

  if (tamanho < 4096) {
    throw new Error("Arquivo muito pequeno para ser um banco de dados válido.");
  }

  try {
    const bytes = await readFile(arquivo);
    const header = new TextDecoder().decode(bytes.slice(0, 15));
    if (!header.startsWith("SQLite format")) {
      throw new Error("O arquivo selecionado não é um banco de dados SQLite válido.");
    }
  } catch (e) {
    if ((e as Error).message.includes("SQLite")) throw e;
    throw new Error("Não foi possível validar o arquivo selecionado.");
  }

  try {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const testDb = await Database.load(`sqlite:${arquivo}`);
    const check = await testDb.select<Record<string, unknown>[]>("PRAGMA integrity_check");
    const resultado = String(Object.values(check[0] ?? {})[0] ?? "");
    await testDb.close();
    if (resultado !== "ok") {
      throw new Error(`O banco de dados está corrompido: ${resultado}`);
    }
  } catch (e) {
    if ((e as Error).message.includes("corrompido")) throw e;
    throw new Error("O arquivo selecionado não é um banco de dados válido ou está corrompido.");
  }

  const confirmou = await confirm(
    `Restaurar backup substituirá TODOS os dados atuais.\n\nArquivo: ${arquivo}\nTamanho: ${formatarTamanho(tamanho)}\n\nEsta ação não pode ser desfeita.\nDeseja continuar?`,
    { title: "Confirmar Restauração", kind: "warning" }
  );

  if (!confirmou) throw new Error("CANCELLED");

  if (usuarioId && connection.dbInstance) {
    await registrarAuditoria({
      usuario_id: usuarioId, acao: "RESTAURACAO", tabela: "sistema",
      descricao: `Restauração de backup: ${arquivo} (${formatarTamanho(tamanho)})`,
    });
  }

  if (connection.dbInstance) {
    try { await connection.dbInstance.close(); } catch { /* ok */ }
    connection.dbInstance = null;
  }

  const dbPath = await getDbPath();
  const preRestorePath = dbPath + ".pre-restore.bak";
  try {
    await copyFile(dbPath, preRestorePath);
  } catch {
    logger.warn("Não foi possível criar backup pré-restauração");
  }
  await copyFile(arquivo, dbPath);
  window.location.reload();
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { formatarTamanho };
