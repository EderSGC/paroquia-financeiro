import type { PapelUsuario } from "@core/types/app.types";

export type Acao =
  | "visualizar"
  | "criar"
  | "editar"
  | "excluir"
  | "emitir_documento"
  | "acessar_financeiro"
  | "acessar_relatorios"
  | "acessar_configuracoes"
  | "restaurar_backup"
  | "gerenciar_usuarios";

export type Modulo =
  | "dashboard"
  | "fieis"
  | "familias"
  | "comunidades"
  | "grupos"
  | "pastorais"
  | "catequese"
  | "sacramentos"
  | "financeiro"
  | "patrimonio"
  | "agenda"
  | "documentos"
  | "config"
  | "configuracoes"
  | "auditoria";

type PermissaoSet = Set<Acao>;
type ModuloPermissoes = Partial<Record<Modulo, PermissaoSet>>;

const ALL_VIEW: Acao[] = ["visualizar"];
const VIEW_REPORT: Acao[] = ["visualizar", "acessar_relatorios"];
const CRUD: Acao[] = ["visualizar", "criar", "editar", "excluir"];
const CRUD_DOC: Acao[] = [...CRUD, "emitir_documento"];
const CRUD_DOC_REP: Acao[] = [...CRUD_DOC, "acessar_relatorios"];
const FULL: Acao[] = [...CRUD_DOC_REP, "acessar_financeiro", "acessar_configuracoes", "restaurar_backup", "gerenciar_usuarios"];

function s(...acoes: Acao[]): PermissaoSet { return new Set(acoes); }
function fromArray(acoes: Acao[]): PermissaoSet { return new Set(acoes); }

function allModules(acoes: Acao[]): ModuloPermissoes {
  const set = fromArray(acoes);
  const result: ModuloPermissoes = {};
  const mods: Modulo[] = [
    "dashboard", "fieis", "familias", "comunidades", "grupos", "pastorais",
    "catequese", "sacramentos", "financeiro", "patrimonio", "agenda",
    "documentos", "config", "configuracoes", "auditoria",
  ];
  for (const m of mods) result[m] = set;
  return result;
}

const PERMISSOES: Record<PapelUsuario, ModuloPermissoes> = {
  admin: allModules(FULL),

  paroquia: allModules(FULL),

  // Vigário é juridicamente o ecônomo da paróquia — acesso total (decisão do pároco, 2026-07-03)
  vigario: allModules(FULL),

  // Secretária com acesso total por decisão do pároco (2026-07-03)
  secretaria: allModules(FULL),

  tesoureiro: {
    dashboard: fromArray(ALL_VIEW),
    fieis: s("visualizar"),
    familias: s("visualizar"),
    comunidades: s("visualizar"),
    financeiro: s("visualizar", "criar", "editar", "excluir", "acessar_financeiro", "acessar_relatorios"),
    patrimonio: fromArray(CRUD),
    documentos: s("visualizar", "emitir_documento"),
    auditoria: s("visualizar"),
  },

  catequista: {
    dashboard: fromArray(ALL_VIEW),
    fieis: s("visualizar"),
    familias: s("visualizar"),
    comunidades: s("visualizar"),
    catequese: fromArray(CRUD_DOC_REP),
    documentos: s("visualizar", "emitir_documento"),
  },

  // Membro opera o caixa da própria comunidade (lançar/editar/excluir),
  // mas todo dado exibido é filtrado pela comunidade dele — nunca vê outras.
  membro: {
    dashboard: fromArray(ALL_VIEW),
    fieis: fromArray(CRUD),
    familias: s("visualizar"),
    comunidades: s("visualizar"),
    grupos: s("visualizar"),
    pastorais: s("visualizar"),
    catequese: s("visualizar"),
    financeiro: s("visualizar", "criar", "editar", "excluir", "acessar_financeiro", "acessar_relatorios"),
    patrimonio: s("visualizar"),
  },
};

export function hasPermission(papel: PapelUsuario, modulo: Modulo | string, acao: Acao): boolean {
  const modPerms = PERMISSOES[papel];
  if (!modPerms) return false;
  const acoes = modPerms[modulo as Modulo];
  if (!acoes) return false;
  return acoes.has(acao);
}

export function canAccessModule(papel: PapelUsuario, modulo: string): boolean {
  return hasPermission(papel, modulo as Modulo, "visualizar");
}

export function getPermissions(papel: PapelUsuario, modulo: Modulo | string): Acao[] {
  const modPerms = PERMISSOES[papel];
  if (!modPerms) return [];
  const acoes = modPerms[modulo as Modulo];
  if (!acoes) return [];
  return Array.from(acoes);
}

export function getAllModulesForPapel(papel: PapelUsuario): Modulo[] {
  const modPerms = PERMISSOES[papel];
  if (!modPerms) return [];
  return Object.keys(modPerms).filter(m => modPerms[m as Modulo]?.has("visualizar")) as Modulo[];
}

export const LABEL_ACAO: Record<Acao, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  emitir_documento: "Emitir Documento",
  acessar_financeiro: "Acessar Financeiro",
  acessar_relatorios: "Acessar Relatórios",
  acessar_configuracoes: "Acessar Configurações",
  restaurar_backup: "Restaurar Backup",
  gerenciar_usuarios: "Gerenciar Usuários",
};

export const LABEL_MODULO: Record<Modulo, string> = {
  dashboard: "Dashboard",
  fieis: "Fiéis",
  familias: "Famílias",
  comunidades: "Comunidades",
  grupos: "Grupos",
  pastorais: "Pastorais",
  catequese: "Catequese",
  sacramentos: "Sacramentos",
  financeiro: "Financeiro",
  patrimonio: "Patrimônio",
  agenda: "Agenda",
  documentos: "Documentos",
  config: "Configurações",
  configuracoes: "Configurações",
  auditoria: "Auditoria",
};
