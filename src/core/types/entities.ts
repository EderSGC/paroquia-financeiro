/**
 * entities.ts — interfaces que espelham exatamente as linhas do banco SQLite.
 *
 * Regras:
 *  - Cada campo usa o tipo que o plugin @tauri-apps/plugin-sql devolve em db.select().
 *  - Colunas TEXT/DATETIME opcionais → string | null.
 *  - Colunas INTEGER opcionais → number | null (0/1 para booleanos).
 *  - Campos obrigatórios no banco (notNull: true sem default) são required aqui.
 *  - UsuarioRow e ParoquiaRow levam sufixo "Row" para não conflitar com os tipos
 *    orientados à UI já definidos em @core/types/app.types.
 */

// ─── PESSOAS / COMUNIDADES ────────────────────────────────────────────────────

export interface Fiel {
  id: number;
  nome: string;
  data_nascimento?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cpf?: string | null;
  comunidade_id?: number | null;
  comunidade?: string | null;
  isDizimista?: number | null;
  /** @deprecated Campo legado sem uso — preservado no banco, não usar em código novo. */
  pai_mae_responsavel?: string | null;
  /** @deprecated Campo legado sem uso — preservado no banco, não usar em código novo. */
  sacramentos?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface Comunidade {
  id: number;
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  coordenador_nome?: string | null;
  coordenador_tel?: string | null;
  tesoureiro_nome?: string | null;
  tesoureiro_tel?: string | null;
  secretario_nome?: string | null;
  secretario_tel?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface Familia {
  id: number;
  sobrenome: string;
  endereco?: string | null;
  comunidade_id?: number | null;
  comunidade?: string | null;
  responsavel_id?: number | null;
  recebe_caritas?: number | null;
  observacoes?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface MembroFamilia {
  id: number;
  familia_id?: number | null;
  fiel_id?: number | null;
  parentesco?: string | null;
  situacao_sacramental?: string | null;
  participacao_pastoral?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────

/** Tipo UI-orientado para Usuario existe em @core/types/app.types — este é o row do banco. */
export interface UsuarioRow {
  id: number;
  nome?: string | null;
  login?: string | null;
  senha?: string | null;
  perfil?: string | null;
  nivel?: string | null;
  email?: string | null;
  papel?: string | null;
  comunidade_id?: number | null;
  ativo?: number | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

// ─── FINANCEIRO ───────────────────────────────────────────────────────────────

export interface Lancamento {
  id: number;
  fiel_id?: number | null;
  categoria?: string | null;
  descricao?: string | null;
  valor?: number | null;
  metodo?: string | null;
  data?: string | null;
  tipo?: string | null;
  origem?: string | null;
  doc_num?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface Conta {
  id: number;
  nome?: string | null;
  tipo?: string | null;
  banco?: string | null;
  agencia?: string | null;
  numero?: string | null;
  comunidade?: string | null;
  saldo?: number | null;
  descricao?: string | null;
  ativo?: number | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface CaixaFechamento {
  id: number;
  data: string;
  unidade: string;
  dinheiro?: number | null;
  pix?: number | null;
  saldo_anterior?: number | null;
  saldo_disponivel?: number | null;
  observacao?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── SACRAMENTOS ──────────────────────────────────────────────────────────────

export interface SacramentoRegistro {
  id: number;
  tipo: string;
  fiel_id?: number | null;
  nome_principal?: string | null;
  data_sacramento?: string | null;
  celebrante?: string | null;
  comunidade?: string | null;
  livro?: string | null;
  folha?: string | null;
  assento?: string | null;
  json_dados?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface ObitoExequia {
  id: number;
  fiel_id?: number | null;
  nome?: string | null;
  dataNasc?: string | null;
  dataFalecimento?: string | null;
  dataExequias?: string | null;
  local?: string | null;
  ministro?: string | null;
  cemiterio?: string | null;
  obs?: string | null;
  comunidade?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

// ─── CATEQUESE ────────────────────────────────────────────────────────────────

export interface CatequeseTurma {
  id: number;
  nome: string;
  etapa: string;
  ano: number;
  comunidade?: string | null;
  horario?: string | null;
  catequista_id?: string | null;
  nome_catequista?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface Catequista {
  id: number;
  nome: string;
  telefone?: string | null;
  comunidade?: string | null;
  disponibilidade?: string | null;
  fiel_id?: number | null;
  nome_fiel?: string | null;
  formacao?: string | null;
  tel_fiel?: string | null;
  email_fiel?: string | null;
  endereco_fiel?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface CatequeseFicha {
  id: number;
  atividade?: string | null;
  nome?: string | null;
  nascimento?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  email?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  data_inscricao?: string | null;
  turma_id?: number | null;
  fiel_id?: number | null;
  documento_entregue?: number | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface CatequeseMatricula {
  id: number;
  turma_id?: number | null;
  ficha_id?: number | null;
  nome_catequizando?: string | null;
  fiel_id?: number | null;
  situacao?: string | null;
  docs_entregues?: string | null;
  frequencia?: string | null;
  observacoes?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface CatequeseEncontro {
  id: number;
  turma_id?: number | null;
  tema?: string | null;
  data?: string | null;
  presencas?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CatequesePresenca {
  id: number;
  matricula_id?: number | null;
  data?: string | null;
  presente?: number | null;
  justificativa?: string | null;
  encontro_id?: number | null;
  status?: string | null;
  observacao?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── PASTORAL ─────────────────────────────────────────────────────────────────

export interface Pastoral {
  id: number;
  nome: string;
  descricao?: string | null;
  carisma?: string | null;
  comunidade_id?: number | null;
  comunidade?: string | null;
  coordenador_id?: number | null;
  coordenador_nome?: string | null;
  coordenador_tel?: string | null;
  vice_id?: number | null;
  vice_nome?: string | null;
  vice_tel?: string | null;
  secretario_id?: number | null;
  secretario_nome?: string | null;
  secretario_tel?: string | null;
  tesoureiro_id?: number | null;
  tesoureiro_nome?: string | null;
  tesoureiro_tel?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface Grupo {
  id: number;
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  objetivos?: string | null;
  pastoral_id?: number | null;
  comunidade_id?: number | null;
  comunidade?: string | null;
  coordenador_id?: number | null;
  coordenador_nome?: string | null;
  coordenador_tel?: string | null;
  coordenador_email?: string | null;
  vice_id?: number | null;
  vice_nome?: string | null;
  vice_tel?: string | null;
  vice_email?: string | null;
  secretario_id?: number | null;
  secretario_nome?: string | null;
  secretario_tel?: string | null;
  secretario_email?: string | null;
  tesoureiro_id?: number | null;
  tesoureiro_nome?: string | null;
  tesoureiro_tel?: string | null;
  tesoureiro_email?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface GrupoMembro {
  id: number;
  grupo_id?: number | null;
  fiel_id?: number | null;
  cargo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── PATRIMÔNIO ───────────────────────────────────────────────────────────────

export interface PatrimonioBem {
  id: number;
  nome: string;
  categoria: string;
  localizacao?: string | null;
  comunidade_id?: number | null;
  data_aquisicao?: string | null;
  valor_estimado?: number | null;
  estado_conservacao?: string | null;
  foto_path?: string | null;
  documento_path?: string | null;
  observacoes?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface PatrimonioManutencao {
  id: number;
  bem_id: number;
  data_manutencao: string;
  descricao: string;
  prestador_servico?: string | null;
  valor_gasto?: number | null;
  observacoes?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── AGENDA / DOCUMENTOS ──────────────────────────────────────────────────────

export interface AgendaCompromisso {
  id: number;
  titulo: string;
  descricao?: string | null;
  data: string;
  horario: string;
  local: string;
  categoria: string;
  fiel_id?: number | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DocumentoRegistro {
  id: number;
  tipo: string;
  numero_protocolo?: string | null;
  assunto?: string | null;
  destinatario?: string | null;
  signatario?: string | null;
  data_emissao?: string | null;
  json_dados?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

// ─── PARÓQUIA / CONFIG ────────────────────────────────────────────────────────

/** Tipo UI-orientado para Paroquia existe em @core/types/app.types — este é o row do banco. */
export interface ParoquiaRow {
  id: number;
  nome?: string | null;
  diocese?: string | null;
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
  cep?: string | null;
  email?: string | null;
  telefone?: string | null;
  cnpj?: string | null;
  logo_path?: string | null;
  diocese_logo_path?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ConfiguracaoPartilha {
  id: number;
  comunidade?: number | null;
  area_missionaria?: number | null;
  arquidiocese?: number | null;
  fundo_missionario?: number | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── AUDITORIA / LOG ──────────────────────────────────────────────────────────

export interface Auditoria {
  id: number;
  usuario_id?: number | null;
  acao: string;
  tabela: string;
  registro_id?: number | null;
  descricao?: string | null;
  data_hora?: string | null;
  uuid?: string | null;
  created_at?: string | null;
}

// ─── CONTROLE DE MIGRATIONS ───────────────────────────────────────────────────

export interface SchemaMigration {
  version: number;
  description: string;
  applied_at?: string | null;
}
