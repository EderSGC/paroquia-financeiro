/**
 * ============================================================================
 * SISTEMA DE GESTÃO PAROQUIAL
 * Arquivo central de configurações globais
 * ============================================================================
 */

/* ============================================================================
 * SISTEMA
 * ========================================================================== */

export const APP = {
  NAME: "Financeiro Paroquial",
  VERSION: "1.5.0",
  COMPANY: "Paróquia",
  ENVIRONMENT: import.meta.env.MODE,
} as const;

/* ============================================================================
 * SEGURANÇA
 * ========================================================================== */

export const SECURITY = {
  MIN_PASSWORD_LENGTH: 6,
  MIN_LOGIN_LENGTH: 3,
  MIN_NAME_LENGTH: 3,

  SESSION_TIMEOUT_MS: 30 * 60 * 1000,

  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
} as const;

/* ============================================================================
 * BANCO DE DADOS
 * ========================================================================== */

export const DATABASE = {
  NAME: "pastoral.db",

  MAX_LOGS: 500,

  BACKUP_INTERVAL_MS: 60 * 60 * 1000,

  AUTO_MIGRATION: true,
} as const;

/* ============================================================================
 * BACKUP
 * ========================================================================== */

export const BACKUP = {
  ENABLED: true,

  KEEP_LAST_FILES: 10,

  AUTO_BACKUP_INTERVAL_MS:
    24 * 60 * 60 * 1000,
} as const;

/* ============================================================================
 * LOGS
 * ========================================================================== */

export const LOGS = {
  ENABLED: true,

  MAX_ENTRIES: 10000,

  SAVE_TO_FILE: true,
} as const;

/* ============================================================================
 * TAURI
 * ========================================================================== */

export const TAURI = {
  ENABLE_DEVTOOLS: import.meta.env.DEV,

  ENABLE_LOGGER: true,

  ENABLE_SQLITE: true,
} as const;

/* ============================================================================
 * UI / TEMA
 * ========================================================================== */

export const THEME = {
  PRIMARY_COLOR: "#3d4db3",

  SECONDARY_COLOR: "#1e2340",

  SUCCESS_COLOR: "#15803d",

  ERROR_COLOR: "#dc2626",

  WARNING_COLOR: "#f59e0b",

  INFO_COLOR: "#3b82f6",

  LIGHT_BG: "#f5f6fa",

  LIGHT_BORDER: "#e5e7eb",
} as const;

/* ============================================================================
 * ANIMAÇÕES / TEMPOS
 * ========================================================================== */

export const TIMING = {
  SPLASH_SCREEN_DURATION: 2800,

  FADE_IN_DELAY: 100,

  FADE_OUT_DELAY: 2200,

  ANIMATION_DURATION: 600,

  DEBOUNCE_DELAY: 300,

  API_TIMEOUT: 10000,
} as const;

/* ============================================================================
 * RESPONSIVIDADE
 * ========================================================================== */

export const BREAKPOINTS = {
  MOBILE: 320,

  TABLET: 768,

  DESKTOP: 1024,

  WIDE: 1280,
} as const;

/* ============================================================================
 * MENSAGENS
 * ========================================================================== */

export const MESSAGES = {
  ERROR_LOGIN_REQUIRED:
    "Digite seu login para continuar.",

  ERROR_PASSWORD_REQUIRED:
    "Digite sua senha para continuar.",

  ERROR_INVALID_CREDENTIALS:
    "Login ou senha incorretos.",

  ERROR_CONNECTION:
    "Erro ao conectar ao sistema.",

  ERROR_DATABASE:
    "Erro ao acessar o banco de dados.",

  ERROR_SETUP:
    "Erro ao salvar configurações.",

  SUCCESS_LOGIN:
    "Login realizado com sucesso!",

  SUCCESS_SETUP:
    "Sistema configurado com sucesso!",

  SUCCESS_PASSWORD_CHANGED:
    "Senha atualizada com sucesso.",

  WARNING_SESSION_EXPIRE:
    "Sua sessão expirará em breve.",

  WARNING_UNSAVED_CHANGES:
    "Existem alterações não salvas.",

  INFO_LOADING:
    "Carregando...",

  INFO_PROCESSING:
    "Processando...",
} as const;

/* ============================================================================
 * API
 * ========================================================================== */

export const ENDPOINTS = {
  API_BASE:
    import.meta.env.VITE_API_URL ??
    "http://localhost:3000/api",

  API_TIMEOUT: 10000,
} as const;

/* ============================================================================
 * VALIDAÇÕES
 * ========================================================================== */

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  LOGIN_REGEX: /^[a-z0-9._-]+$/,

  CNPJ_REGEX:
    /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,

  CEP_REGEX:
    /^\d{5}-?\d{3}$/,

  PHONE_REGEX:
    /^\+?[\d\s()-]+$/,
} as const;

/* ============================================================================
 * LOCALIZAÇÃO
 * ========================================================================== */

export const LOCALE = {
  DEFAULT: "pt-BR",

  TIMEZONE: "America/Manaus",
} as const;

/* ============================================================================
 * PAGINAÇÃO
 * ========================================================================== */

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,

  MAX_PAGE_SIZE: 100,
} as const;

/* ============================================================================
 * NOTIFICAÇÕES
 * ========================================================================== */

export const NOTIFICATIONS = {
  DURATION: 3000,

  MAX_NOTIFICATIONS: 5,
} as const;

/* ============================================================================
 * FEATURE FLAGS
 * ========================================================================== */

export const FEATURES = {
  FINANCEIRO: true,

  CATEQUESE: true,

  PATRIMONIO: true,

  DIZIMO: true,

  SACRAMENTOS: true,

  OBITOS_EXEQUIAS: true,

  RELATORIOS: true,

  BACKUP: true,
} as const;

/* ============================================================================
 * CONFIG GLOBAL
 * ========================================================================== */

export const CONFIG = {
  APP,
  SECURITY,
  DATABASE,
  BACKUP,
  LOGS,
  TAURI,
  THEME,
  TIMING,
  BREAKPOINTS,
  MESSAGES,
  ENDPOINTS,
  VALIDATION,
  LOCALE,
  PAGINATION,
  NOTIFICATIONS,
  FEATURES,
} as const;

/* ============================================================================
 * HELPERS
 * ========================================================================== */

export function getConfig<
  T extends keyof typeof CONFIG,
  K extends keyof (typeof CONFIG)[T]
>(section: T, key: K) {
  return CONFIG[section][key];
}

export default CONFIG;