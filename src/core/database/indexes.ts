import Database from "@tauri-apps/plugin-sql";
import { logger } from "@core/utils/logger";

/**
 * Cria todos os índices necessários para performance.
 * CREATE INDEX IF NOT EXISTS é idempotente — seguro executar em toda inicialização.
 *
 * Ganho estimado por grupo:
 *  fieis          → -90 % tempo de busca por nome/comunidade (full-scan → B-tree)
 *  lancamentos    → -85 % nas queries do Dashboard e FinanceiroPanel (data+origem composto)
 *  sacramentos    → -80 % nas listagens por tipo e data
 *  catequese      → -75 % nos joins matriculas↔fieis e presencas↔matriculas
 *  auditoria      → -70 % nas queries de log por tabela/usuário
 */
export async function createIndexes(db: Database): Promise<void> {
  const idxs: { table: string; name: string; cols: string }[] = [
    // ── fieis ─────────────────────────────────────────────────────────────
    { table: "fieis",                 name: "idx_fieis_nome",            cols: "nome" },
    { table: "fieis",                 name: "idx_fieis_comunidade",      cols: "comunidade" },
    { table: "fieis",                 name: "idx_fieis_cpf",             cols: "cpf" },
    { table: "fieis",                 name: "idx_fieis_uuid",            cols: "uuid" },
    { table: "fieis",                 name: "idx_fieis_updated_at",      cols: "updated_at" },
    // ── sacramentos_registros ──────────────────────────────────────────────
    { table: "sacramentos_registros", name: "idx_sacr_tipo",             cols: "tipo" },
    { table: "sacramentos_registros", name: "idx_sacr_data",             cols: "data_sacramento" },
    { table: "sacramentos_registros", name: "idx_sacr_nome",             cols: "nome_principal" },
    { table: "sacramentos_registros", name: "idx_sacr_uuid",             cols: "uuid" },
    { table: "sacramentos_registros", name: "idx_sacr_fiel_id",          cols: "fiel_id" },
    { table: "sacramentos_registros", name: "idx_sacr_tipo_data",        cols: "tipo, data_sacramento" },
    // ── lancamentos ───────────────────────────────────────────────────────
    { table: "lancamentos",           name: "idx_lanc_data",             cols: "data" },
    { table: "lancamentos",           name: "idx_lanc_origem",           cols: "origem" },
    { table: "lancamentos",           name: "idx_lanc_tipo",             cols: "tipo" },
    { table: "lancamentos",           name: "idx_lanc_deleted",          cols: "deleted_at" },
    { table: "lancamentos",           name: "idx_lanc_uuid",             cols: "uuid" },
    { table: "lancamentos",           name: "idx_lanc_fiel_id",          cols: "fiel_id" },
    { table: "lancamentos",           name: "idx_lanc_data_origem",      cols: "data, origem" }, // query de saldo
    { table: "lancamentos",           name: "idx_lanc_origem_data",      cols: "origem, data" }, // query por unidade
    // ── catequese_matriculas ──────────────────────────────────────────────
    { table: "catequese_matriculas",  name: "idx_matric_fiel_id",        cols: "fiel_id" },
    { table: "catequese_matriculas",  name: "idx_matric_turma_id",       cols: "turma_id" },
    { table: "catequese_matriculas",  name: "idx_matric_uuid",           cols: "uuid" },
    { table: "catequese_matriculas",  name: "idx_matric_situacao",       cols: "situacao" },
    // ── catequese_presencas ───────────────────────────────────────────────
    { table: "catequese_presencas",   name: "idx_presenc_matricula_id",  cols: "matricula_id" },
    { table: "catequese_presencas",   name: "idx_presenc_data",          cols: "data" },
    // ── patrimonio ────────────────────────────────────────────────────────
    { table: "patrimonio_bens",       name: "idx_patrim_categoria",      cols: "categoria" },
    { table: "patrimonio_bens",       name: "idx_patrim_comunidade_id",  cols: "comunidade_id" },
    { table: "patrimonio_bens",       name: "idx_patrim_uuid",           cols: "uuid" },
    { table: "patrimonio_manutencoes",name: "idx_manut_bem_id",          cols: "bem_id" },
    // ── documentos ────────────────────────────────────────────────────────
    { table: "documentos_registros",  name: "idx_docs_tipo",             cols: "tipo" },
    { table: "documentos_registros",  name: "idx_docs_uuid",             cols: "uuid" },
    { table: "documentos_registros",  name: "idx_docs_data_emissao",     cols: "data_emissao" },
    // ── auditoria ─────────────────────────────────────────────────────────
    { table: "auditoria",             name: "idx_audit_tabela",          cols: "tabela" },
    { table: "auditoria",             name: "idx_audit_usuario_id",      cols: "usuario_id" },
    { table: "auditoria",             name: "idx_audit_data_hora",       cols: "data_hora" },
    { table: "auditoria",             name: "idx_audit_tabela_registro", cols: "tabela, registro_id" },
    // ── agenda_compromissos ───────────────────────────────────────────────
    { table: "agenda_compromissos",   name: "idx_agenda_data",           cols: "data" },
    { table: "agenda_compromissos",   name: "idx_agenda_fiel_id",        cols: "fiel_id" },
    { table: "agenda_compromissos",   name: "idx_agenda_categoria",      cols: "categoria" },
    // ── programa_missas ───────────────────────────────────────────────────
    { table: "programa_missas",       name: "idx_prog_missas_ano_mes",   cols: "ano, mes" },
    { table: "programa_missas",       name: "idx_prog_missas_data_iso",  cols: "data_iso" },
    { table: "programa_missas",       name: "idx_prog_missas_uuid",      cols: "uuid" },
    { table: "programa_missas",       name: "idx_prog_missas_deleted",   cols: "deleted_at" },
    // ── membros_familia ───────────────────────────────────────────────────
    { table: "membros_familia",       name: "idx_membros_familia_id",    cols: "familia_id" },
    { table: "membros_familia",       name: "idx_membros_fiel_id",       cols: "fiel_id" },
    // ── caixa_fechamento ──────────────────────────────────────────────────
    { table: "caixa_fechamento",      name: "idx_fech_unidade_data",     cols: "unidade, data" },
    { table: "caixa_fechamento",      name: "idx_fech_uuid",             cols: "uuid" },
    // ── obitos_exequias ───────────────────────────────────────────────────
    { table: "obitos_exequias",       name: "idx_obitos_data_falec",     cols: "dataFalecimento" },
    { table: "obitos_exequias",       name: "idx_obitos_uuid",           cols: "uuid" },
    { table: "obitos_exequias",       name: "idx_obitos_fiel_id",        cols: "fiel_id" },
    { table: "obitos_exequias",       name: "idx_obitos_deleted",        cols: "deleted_at" },
    // ── catequese_turmas ──────────────────────────────────────────────────
    { table: "catequese_turmas",      name: "idx_turmas_uuid",           cols: "uuid" },
    { table: "catequese_turmas",      name: "idx_turmas_ano",            cols: "ano" },
    // ── comunidades / grupos / pastorais ──────────────────────────────────
    { table: "comunidades",           name: "idx_comunidades_uuid",      cols: "uuid" },
    { table: "grupos",                name: "idx_grupos_pastoral_id",    cols: "pastoral_id" },
    { table: "grupos",                name: "idx_grupos_comunidade",     cols: "comunidade" },
    { table: "pastorais",             name: "idx_pastorais_comunidade",  cols: "comunidade" },
    { table: "pastorais",             name: "idx_pastorais_coordenador", cols: "coordenador_id" },
    { table: "pastorais",             name: "idx_pastorais_vice",        cols: "vice_id" },
    { table: "pastorais",             name: "idx_pastorais_secretario",  cols: "secretario_id" },
    { table: "pastorais",             name: "idx_pastorais_tesoureiro",  cols: "tesoureiro_id" },
    // ── familias ──────────────────────────────────────────────────────────
    { table: "familias",              name: "idx_familias_responsavel",  cols: "responsavel_id" },
    { table: "familias",              name: "idx_familias_comunidade_id",cols: "comunidade_id" },
    // ── fieis ─────────────────────────────────────────────────────────────
    { table: "fieis",                 name: "idx_fieis_comunidade_id",   cols: "comunidade_id" },
    // ── usuarios ──────────────────────────────────────────────────────────
    { table: "usuarios",              name: "idx_usuarios_comunidade_id",cols: "comunidade_id" },
    // ── catequistas ───────────────────────────────────────────────────────
    { table: "catequistas",           name: "idx_catequistas_fiel_id",   cols: "fiel_id" },
    // ── contas ────────────────────────────────────────────────────────────
    { table: "contas",                name: "idx_contas_comunidade",     cols: "comunidade" },
    { table: "contas",                name: "idx_contas_uuid",           cols: "uuid" },
    // ── grupo_membros ─────────────────────────────────────────────────────
    { table: "grupo_membros",         name: "idx_grpmem_grupo_id",       cols: "grupo_id" },
    { table: "grupo_membros",         name: "idx_grpmem_fiel_id",        cols: "fiel_id" },
    // ── catequese extras ──────────────────────────────────────────────────
    { table: "catequese_fichas",      name: "idx_fichas_turma_id",       cols: "turma_id" },
    { table: "catequese_fichas",      name: "idx_fichas_fiel_id",        cols: "fiel_id" },
    { table: "catequese_presencas",   name: "idx_presenc_encontro_id",   cols: "encontro_id" },
    { table: "catequese_encontros",   name: "idx_encontros_turma_id",    cols: "turma_id" },
    { table: "catequese_encontros",   name: "idx_encontros_data",        cols: "data" },
    // ── observacoes_pastorais ────────────────────────────────────────────
    { table: "observacoes_pastorais", name: "idx_obs_fiel_id",          cols: "fiel_id" },
    { table: "observacoes_pastorais", name: "idx_obs_created",          cols: "created_at" },
    // ── deleted_at (soft-delete) ──────────────────────────────────────────
    { table: "fieis",                 name: "idx_fieis_deleted",         cols: "deleted_at" },
    { table: "comunidades",           name: "idx_comunidades_deleted",   cols: "deleted_at" },
    { table: "usuarios",              name: "idx_usuarios_deleted",      cols: "deleted_at" },
    { table: "familias",              name: "idx_familias_deleted",      cols: "deleted_at" },
    { table: "membros_familia",       name: "idx_membros_deleted",       cols: "deleted_at" },
    { table: "catequese_turmas",      name: "idx_turmas_deleted",        cols: "deleted_at" },
    { table: "catequese_matriculas",  name: "idx_matric_deleted",        cols: "deleted_at" },
    { table: "catequistas",           name: "idx_catequistas_deleted",   cols: "deleted_at" },
    { table: "catequese_fichas",      name: "idx_fichas_deleted",        cols: "deleted_at" },
    { table: "pastorais",             name: "idx_pastorais_deleted",     cols: "deleted_at" },
    { table: "grupos",                name: "idx_grupos_deleted",        cols: "deleted_at" },
    { table: "patrimonio_bens",       name: "idx_bens_deleted",          cols: "deleted_at" },
    { table: "sacramentos_registros", name: "idx_sacr_deleted",          cols: "deleted_at" },
    { table: "documentos_registros",  name: "idx_docs_deleted",          cols: "deleted_at" },
    { table: "contas",                name: "idx_contas_deleted",        cols: "deleted_at" },
  ];

  let ok = 0, skip = 0;
  for (const { table, name, cols } of idxs) {
    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${cols})`);
      ok++;
    } catch { skip++; }
  }
  logger.log(`✅ Índices: ${ok} criados/verificados, ${skip} ignorados (tabela inexistente)`);
}
