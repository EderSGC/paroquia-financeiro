import { TableSchema } from "./types";

/**
 * EXPECTED_SCHEMA — fonte de verdade da estrutura do banco.
 *
 * validateAndSyncSchema() lê este array e:
 *   • Cria tabelas ausentes com CREATE TABLE IF NOT EXISTS.
 *   • Adiciona colunas faltantes com ALTER TABLE ADD COLUMN (nunca destrói dados).
 *
 * Regras:
 *   • Preservar TODAS as colunas que existem no banco real, mesmo legadas.
 *   • Novas colunas (ex.: deleted_at) são adicionadas aqui e ficam disponíveis
 *     na próxima inicialização do app via ALTER TABLE.
 *   • A ordem das colunas dentro de cada tabela segue: id → negócio → sync → soft-delete.
 */
export const EXPECTED_SCHEMA: TableSchema[] = [
  // ────────────────────────────────────────────────────────────────────────────
  // PESSOAS / COMUNIDADES
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "fieis",
    columns: [
      { name: "id",                  type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",                type: "TEXT", notNull: true },
      { name: "data_nascimento",     type: "TEXT" },
      { name: "telefone",            type: "TEXT" },
      { name: "email",               type: "TEXT" },  // adicionado por usePastoral.ts
      { name: "endereco",            type: "TEXT" },  // adicionado por usePastoral.ts
      { name: "cpf",                  type: "TEXT" },
      { name: "comunidade_id",       type: "INTEGER" },
      { name: "comunidade",          type: "TEXT" },
      { name: "isDizimista",         type: "INTEGER",  default: "0" },
      { name: "pai_mae_responsavel", type: "TEXT" },
      { name: "sacramentos",         type: "TEXT" },
      { name: "uuid",                type: "TEXT" },
      { name: "created_at",          type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",          type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",          type: "DATETIME" },
    ],
  },
  {
    name: "comunidades",
    columns: [
      { name: "id",               type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",             type: "TEXT", notNull: true },
      { name: "cnpj",             type: "TEXT" },
      { name: "endereco",         type: "TEXT" },
      { name: "coordenador_nome", type: "TEXT" },
      { name: "coordenador_tel",  type: "TEXT" },
      { name: "tesoureiro_nome",  type: "TEXT" },
      { name: "tesoureiro_tel",   type: "TEXT" },
      { name: "secretario_nome",  type: "TEXT" },
      { name: "secretario_tel",   type: "TEXT" },
      { name: "uuid",             type: "TEXT" },
      { name: "created_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",       type: "DATETIME" },
    ],
  },
  {
    name: "familias",
    columns: [
      { name: "id",             type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "sobrenome",      type: "TEXT", notNull: true },
      { name: "endereco",       type: "TEXT" },
      { name: "comunidade_id", type: "INTEGER" },
      { name: "comunidade",     type: "TEXT" },
      { name: "responsavel_id", type: "INTEGER" },
      { name: "recebe_caritas", type: "INTEGER", default: "0" },
      { name: "observacoes",    type: "TEXT" },
      { name: "uuid",           type: "TEXT" },
      { name: "created_at",     type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",     type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",     type: "DATETIME" },
    ],
  },
  {
    name: "membros_familia",
    columns: [
      { name: "id",                    type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "familia_id",            type: "INTEGER" },
      { name: "fiel_id",               type: "INTEGER" },
      { name: "parentesco",            type: "TEXT" },
      { name: "situacao_sacramental",  type: "TEXT" },
      { name: "participacao_pastoral", type: "TEXT" },
      { name: "uuid",                  type: "TEXT" },
      { name: "created_at",            type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",            type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",            type: "DATETIME" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CONTROLE DE MIGRATIONS
  // ────────────────────────────────────────────────────────────────────────────
  {
    // Tabela de controle criada pelo bootstrap de runMigrations().
    // Incluída aqui para garantir existência antes das migrations rodarem
    // (validateAndSyncSchema precede runMigrations no fluxo de init).
    name: "schema_migrations",
    columns: [
      { name: "version",     type: "INTEGER PRIMARY KEY" },
      { name: "description", type: "TEXT", notNull: true },
      { name: "applied_at",  type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // USUÁRIOS
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "usuarios",
    columns: [
      { name: "id",            type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",          type: "TEXT" },
      { name: "login",         type: "TEXT" },
      { name: "senha",         type: "TEXT" },
      { name: "perfil",        type: "TEXT" },  // legado — coluna real no banco
      { name: "nivel",         type: "TEXT" },
      { name: "email",         type: "TEXT" },
      { name: "papel",         type: "TEXT", default: "'paroquia'" },
      { name: "comunidade_id", type: "INTEGER" },
      { name: "ativo",                type: "INTEGER", default: "1" },
      { name: "pergunta_seguranca",  type: "TEXT" },
      { name: "resposta_seguranca",  type: "TEXT" },
      { name: "uuid",                type: "TEXT" },
      { name: "created_at",          type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",          type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",          type: "DATETIME" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // FINANCEIRO
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "lancamentos",
    columns: [
      { name: "id",         type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "fiel_id",    type: "INTEGER" },
      { name: "categoria",  type: "TEXT" },
      { name: "descricao",  type: "TEXT" },
      { name: "valor",      type: "REAL" },
      { name: "metodo",     type: "TEXT" },
      { name: "data",       type: "TEXT" },
      { name: "tipo",       type: "TEXT" },
      { name: "origem",     type: "TEXT", default: "'PAROQUIA'" },
      { name: "doc_num",    type: "TEXT" },
      { name: "uuid",       type: "TEXT" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at", type: "DATETIME" },
    ],
  },
  {
    name: "contas",
    columns: [
      { name: "id",         type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",       type: "TEXT" },  // real DB: notnull=0
      { name: "tipo",       type: "TEXT" },
      { name: "banco",      type: "TEXT" },
      { name: "agencia",    type: "TEXT" },
      { name: "numero",     type: "TEXT" },
      { name: "comunidade", type: "TEXT" },
      { name: "saldo",      type: "REAL",    default: "0" },
      { name: "descricao",  type: "TEXT" },  // existe no banco real
      { name: "ativo",      type: "INTEGER", default: "1" },  // existe no banco real
      { name: "uuid",       type: "TEXT" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at", type: "DATETIME" },
    ],
  },
  {
    name: "caixa_fechamento",
    columns: [
      { name: "id",               type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "data",             type: "TEXT", notNull: true },
      { name: "unidade",          type: "TEXT", notNull: true },
      { name: "dinheiro",         type: "REAL", default: "0" },
      { name: "pix",              type: "REAL", default: "0" },
      { name: "saldo_anterior",   type: "REAL", default: "0" },
      { name: "saldo_disponivel", type: "REAL", default: "0" },
      { name: "observacao",       type: "TEXT" },
      { name: "uuid",             type: "TEXT" },
      { name: "created_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // SACRAMENTOS
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "sacramentos_registros",
    columns: [
      { name: "id",              type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "tipo",            type: "TEXT", notNull: true },
      { name: "fiel_id",         type: "INTEGER" },
      { name: "nome_principal",  type: "TEXT" },
      { name: "data_sacramento", type: "TEXT" },
      { name: "celebrante",      type: "TEXT" },
      { name: "comunidade",      type: "TEXT" },
      { name: "livro",           type: "TEXT" },  // campo canônico para registro eclesiástico
      { name: "folha",           type: "TEXT" },
      { name: "assento",         type: "TEXT" },
      { name: "json_dados",      type: "TEXT" },
      { name: "uuid",            type: "TEXT" },
      { name: "created_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",      type: "DATETIME" },
    ],
  },
  {
    name: "obitos_exequias",
    columns: [
      { name: "id",              type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "fiel_id",         type: "INTEGER" },
      { name: "nome",            type: "TEXT" },
      { name: "dataNasc",        type: "TEXT" },
      { name: "dataFalecimento", type: "TEXT" },
      { name: "dataExequias",    type: "TEXT" },
      { name: "local",           type: "TEXT" },
      { name: "ministro",        type: "TEXT" },
      { name: "cemiterio",       type: "TEXT" },
      { name: "obs",             type: "TEXT" },
      { name: "comunidade",      type: "TEXT" },
      { name: "uuid",            type: "TEXT" },
      { name: "created_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",      type: "DATETIME" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CATEQUESE
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "catequese_turmas",
    columns: [
      { name: "id",              type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",            type: "TEXT", notNull: true },
      { name: "etapa",           type: "TEXT", notNull: true },
      { name: "ano",             type: "INTEGER", notNull: true },
      { name: "comunidade",      type: "TEXT" },
      { name: "horario",         type: "TEXT" },
      { name: "catequista_id",   type: "TEXT" },  // existe no banco real
      { name: "nome_catequista", type: "TEXT" },  // existe no banco real
      { name: "uuid",            type: "TEXT" },
      { name: "created_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",      type: "DATETIME" },
    ],
  },
  {
    name: "catequistas",
    columns: [
      { name: "id",              type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",            type: "TEXT", notNull: true },
      { name: "telefone",        type: "TEXT" },
      { name: "comunidade",      type: "TEXT" },
      { name: "disponibilidade", type: "TEXT" },
      { name: "fiel_id",         type: "INTEGER" },  // existe no banco real
      { name: "nome_fiel",       type: "TEXT" },     // existe no banco real
      { name: "formacao",        type: "TEXT" },     // existe no banco real
      { name: "tel_fiel",        type: "TEXT" },     // existe no banco real
      { name: "email_fiel",      type: "TEXT" },     // existe no banco real
      { name: "endereco_fiel",   type: "TEXT" },     // existe no banco real
      { name: "uuid",            type: "TEXT" },
      { name: "created_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",      type: "DATETIME" },
    ],
  },
  {
    name: "catequese_fichas",
    columns: [
      { name: "id",                 type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "atividade",          type: "TEXT" },  // existe no banco real
      { name: "nome",               type: "TEXT" },
      { name: "nascimento",         type: "TEXT" },  // existe no banco real
      { name: "endereco",           type: "TEXT" },  // existe no banco real
      { name: "telefone",           type: "TEXT" },  // existe no banco real
      { name: "email",              type: "TEXT" },  // existe no banco real
      { name: "responsavel",        type: "TEXT" },  // existe no banco real
      { name: "observacoes",        type: "TEXT" },
      { name: "data_inscricao",     type: "TEXT" },
      { name: "turma_id",           type: "INTEGER" },
      { name: "fiel_id",            type: "INTEGER" },
      { name: "documento_entregue", type: "INTEGER", default: "0" },
      { name: "uuid",               type: "TEXT" },
      { name: "created_at",         type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",         type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",         type: "DATETIME" },
    ],
  },
  {
    name: "catequese_matriculas",
    columns: [
      { name: "id",                type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "turma_id",          type: "INTEGER" },
      { name: "ficha_id",          type: "INTEGER" },   // existe no banco real
      { name: "nome_catequizando", type: "TEXT" },      // existe no banco real
      { name: "fiel_id",           type: "INTEGER" },
      { name: "situacao",          type: "TEXT" },
      { name: "docs_entregues",    type: "TEXT" },
      { name: "frequencia",        type: "TEXT" },
      { name: "observacoes",       type: "TEXT" },
      { name: "uuid",              type: "TEXT" },
      { name: "created_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",        type: "DATETIME" },
    ],
  },
  {
    name: "catequese_encontros",
    columns: [
      { name: "id",         type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "turma_id",   type: "INTEGER" },
      { name: "tema",       type: "TEXT" },
      { name: "data",       type: "TEXT" },
      { name: "presencas",  type: "TEXT" },
      { name: "uuid",       type: "TEXT" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },
  {
    name: "catequese_presencas",
    columns: [
      { name: "id",            type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "matricula_id",  type: "INTEGER" },
      { name: "data",          type: "TEXT" },
      { name: "presente",      type: "INTEGER" },
      { name: "justificativa", type: "TEXT" },
      { name: "encontro_id",   type: "INTEGER" },  // existe no banco real
      { name: "status",        type: "TEXT" },     // existe no banco real
      { name: "observacao",    type: "TEXT" },     // existe no banco real
      { name: "uuid",          type: "TEXT" },
      { name: "created_at",    type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",    type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // PASTORAL
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "pastorais",
    columns: [
      { name: "id",               type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",             type: "TEXT", notNull: true },
      { name: "descricao",        type: "TEXT" },
      { name: "carisma",          type: "TEXT" },
      { name: "comunidade_id",    type: "INTEGER" },
      { name: "comunidade",       type: "TEXT" },
      { name: "coordenador_id",   type: "INTEGER" },
      { name: "coordenador_nome", type: "TEXT" },
      { name: "coordenador_tel",  type: "TEXT" },
      { name: "vice_id",          type: "INTEGER" },
      { name: "vice_nome",        type: "TEXT" },
      { name: "vice_tel",         type: "TEXT" },
      { name: "secretario_id",    type: "INTEGER" },
      { name: "secretario_nome",  type: "TEXT" },
      { name: "secretario_tel",   type: "TEXT" },
      { name: "tesoureiro_id",    type: "INTEGER" },
      { name: "tesoureiro_nome",  type: "TEXT" },
      { name: "tesoureiro_tel",   type: "TEXT" },
      { name: "uuid",             type: "TEXT" },
      { name: "created_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",       type: "DATETIME" },
    ],
  },
  {
    name: "grupos",
    columns: [
      { name: "id",                type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",              type: "TEXT", notNull: true },
      { name: "categoria",         type: "TEXT" },
      { name: "descricao",         type: "TEXT" },
      { name: "objetivos",         type: "TEXT" },
      { name: "pastoral_id",       type: "INTEGER" },
      { name: "comunidade_id",     type: "INTEGER" },
      { name: "comunidade",        type: "TEXT" },
      { name: "coordenador_id",    type: "INTEGER" },
      { name: "coordenador_nome",  type: "TEXT" },
      { name: "coordenador_tel",   type: "TEXT" },
      { name: "coordenador_email", type: "TEXT" },
      { name: "vice_id",           type: "INTEGER" },
      { name: "vice_nome",         type: "TEXT" },
      { name: "vice_tel",          type: "TEXT" },
      { name: "vice_email",        type: "TEXT" },
      { name: "secretario_id",     type: "INTEGER" },
      { name: "secretario_nome",   type: "TEXT" },
      { name: "secretario_tel",    type: "TEXT" },
      { name: "secretario_email",  type: "TEXT" },
      { name: "tesoureiro_id",     type: "INTEGER" },
      { name: "tesoureiro_nome",   type: "TEXT" },
      { name: "tesoureiro_tel",    type: "TEXT" },
      { name: "tesoureiro_email",  type: "TEXT" },
      { name: "uuid",              type: "TEXT" },
      { name: "created_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",        type: "DATETIME" },
    ],
  },
  {
    // Tabela de junção: membro de grupo
    name: "grupo_membros",
    columns: [
      { name: "id",         type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "grupo_id",   type: "INTEGER" },
      { name: "fiel_id",    type: "INTEGER" },
      { name: "cargo",      type: "TEXT" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // PATRIMÔNIO
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "patrimonio_bens",
    columns: [
      { name: "id",                  type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",                type: "TEXT", notNull: true },
      { name: "categoria",           type: "TEXT", notNull: true },
      { name: "localizacao",         type: "TEXT" },
      { name: "comunidade_id",       type: "INTEGER" },
      { name: "data_aquisicao",      type: "TEXT" },
      { name: "valor_estimado",      type: "REAL" },
      { name: "estado_conservacao",  type: "TEXT" },
      { name: "foto_path",           type: "TEXT" },
      { name: "documento_path",      type: "TEXT" },
      { name: "observacoes",         type: "TEXT" },
      { name: "uuid",                type: "TEXT" },
      { name: "created_at",          type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",          type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",          type: "DATETIME" },
    ],
  },
  {
    name: "patrimonio_manutencoes",
    columns: [
      { name: "id",                type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "bem_id",            type: "INTEGER", notNull: true },
      { name: "data_manutencao",   type: "TEXT", notNull: true },
      { name: "descricao",         type: "TEXT", notNull: true },
      { name: "prestador_servico", type: "TEXT" },
      { name: "valor_gasto",       type: "REAL" },
      { name: "observacoes",       type: "TEXT" },
      { name: "uuid",              type: "TEXT" },
      { name: "created_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // AGENDA / DOCUMENTOS
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "agenda_compromissos",
    columns: [
      { name: "id",         type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "titulo",     type: "TEXT", notNull: true },
      { name: "descricao",  type: "TEXT" },
      { name: "data",       type: "TEXT", notNull: true },
      { name: "horario",    type: "TEXT", notNull: true },
      { name: "local",      type: "TEXT", notNull: true },
      { name: "categoria",  type: "TEXT", notNull: true },
      { name: "fiel_id",    type: "INTEGER" },
      { name: "uuid",       type: "TEXT" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at", type: "DATETIME" },
    ],
  },
  {
    name: "programa_missas",
    columns: [
      { name: "id",               type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "ano",               type: "INTEGER", notNull: true },
      { name: "mes",                type: "INTEGER", notNull: true },
      { name: "data_iso",          type: "TEXT" },
      { name: "data_texto",        type: "TEXT" },
      { name: "observacao",        type: "TEXT" },
      { name: "local",             type: "TEXT" },
      { name: "horario",           type: "TEXT" },
      { name: "celebrante",        type: "TEXT" },
      { name: "cor_data",          type: "TEXT", default: "'#000000'" },
      { name: "cor_local",         type: "TEXT", default: "'#000000'" },
      { name: "cor_horario",       type: "TEXT", default: "'#000000'" },
      { name: "cor_celebrante",    type: "TEXT", default: "'#000000'" },
      { name: "ordem",             type: "INTEGER", default: "0" },
      { name: "compromisso_ids",   type: "TEXT" },
      { name: "uuid",              type: "TEXT" },
      { name: "created_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",        type: "DATETIME" },
    ],
  },
  {
    name: "documentos_registros",
    columns: [
      { name: "id",               type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "tipo",             type: "TEXT", notNull: true },
      { name: "numero_protocolo", type: "TEXT" },
      { name: "assunto",          type: "TEXT" },
      { name: "destinatario",     type: "TEXT" },
      { name: "signatario",       type: "TEXT" },
      { name: "data_emissao",     type: "TEXT" },
      { name: "json_dados",       type: "TEXT" },  // existe no banco real
      { name: "uuid",             type: "TEXT" },
      { name: "created_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "deleted_at",       type: "DATETIME" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // PARÓQUIA / CONFIG
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "paroquia",
    columns: [
      { name: "id",                type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "nome",              type: "TEXT" },  // real DB: notnull=0
      { name: "diocese",           type: "TEXT" },
      { name: "cidade",            type: "TEXT" },
      { name: "estado",            type: "TEXT" },
      { name: "endereco",          type: "TEXT" },
      { name: "cep",               type: "TEXT" },
      { name: "email",             type: "TEXT" },
      { name: "telefone",          type: "TEXT" },
      { name: "cnpj",              type: "TEXT" },
      { name: "logo_path",         type: "TEXT" },
      { name: "diocese_logo_path", type: "TEXT" },
      { name: "confissoes_horario",  type: "TEXT" },
      { name: "atendimento_horario", type: "TEXT" },
      { name: "uuid",              type: "TEXT" },
      { name: "created_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },
  {
    // Nota: a tabela real foi criada com CHECK (id = 1) — esse constraint
    // não é expresso aqui porque CREATE TABLE IF NOT EXISTS não recriarará
    // uma tabela já existente. A constraint permanece no banco.
    name: "configuracoes_partilha",
    columns: [
      { name: "id",                type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "comunidade",        type: "REAL", default: "30" },
      { name: "area_missionaria",  type: "REAL", default: "40" },
      { name: "arquidiocese",      type: "REAL", default: "29" },
      { name: "fundo_missionario", type: "REAL", default: "1" },
      { name: "uuid",              type: "TEXT" },
      { name: "created_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",        type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // AUDITORIA / LOG
  // ────────────────────────────────────────────────────────────────────────────
  {
    // Tabela append-only — sem updated_at intencional
    name: "auditoria",
    columns: [
      { name: "id",              type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "usuario_id",      type: "INTEGER" },
      { name: "acao",            type: "TEXT", notNull: true },
      { name: "tabela",          type: "TEXT", notNull: true },
      { name: "registro_id",     type: "INTEGER" },
      { name: "descricao",       type: "TEXT" },
      { name: "valor_anterior",  type: "TEXT" },
      { name: "valor_novo",      type: "TEXT" },
      { name: "data_hora",       type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "uuid",            type: "TEXT" },
      { name: "created_at",      type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // OBSERVAÇÕES PASTORAIS
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "observacoes_pastorais",
    columns: [
      { name: "id",          type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "fiel_id",     type: "INTEGER", notNull: true },
      { name: "autor",       type: "TEXT" },
      { name: "tipo",        type: "TEXT", default: "'GERAL'" },
      { name: "texto",       type: "TEXT", notNull: true },
      { name: "uuid",        type: "TEXT" },
      { name: "created_at",  type: "DATETIME", default: "CURRENT_TIMESTAMP" },
      { name: "updated_at",  type: "DATETIME", default: "CURRENT_TIMESTAMP" },
    ],
  },
];
