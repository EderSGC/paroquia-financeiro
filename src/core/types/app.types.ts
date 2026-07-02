// src/core/types/app.types.ts

// Tipo que controla as telas principais do fluxo do sistema
export type Tela = "splash" | "setup" | "login" | "app";

// Tipo que mapeia os módulos funcionais da aplicação (Adicionado o módulo patrimônio)
export type Modulo =
  | "dashboard"
  | "documentos"
  | "pastorais"
  | "catequese"
  | "sacramentos"
  | "financeiro"
  | "agenda"
  | "config"
  | "patrimonio"; // 🌟 Nova string adicionada para o módulo de bens

// Interface que define os dados institucionais da Paróquia (Mantida 100% original)
export interface Paroquia {
  id?: number;
  nome: string;
  diocese: string;
  cidade?: string;
  estado?: string;
  endereco: string;
  cep?: string;
  email: string;
  telefone: string;
  cnpj: string;
  logo_path?: string;
  diocese_logo_path?: string;
  logo?: string;
  confissoes_horario?: string;
  atendimento_horario?: string;
}

// Papéis de acesso do sistema
export type PapelUsuario =
  | 'admin'
  | 'paroquia'
  | 'vigario'
  | 'secretaria'
  | 'tesoureiro'
  | 'catequista'
  | 'membro';

// Papéis com acesso total ao sistema (todos os módulos)
export const PAPEIS_ACESSO_TOTAL: PapelUsuario[] = ['admin', 'paroquia', 'vigario', 'secretaria'];

// Módulos acessíveis por papel restrito
export const MODULOS_POR_PAPEL: Record<PapelUsuario, string[]> = {
  admin:       [],   // sem restrição
  paroquia:    [],   // sem restrição
  vigario:     [],   // sem restrição
  secretaria:  [],   // sem restrição
  tesoureiro:  ['financeiro', 'patrimonio', 'comunidades'],
  catequista:  ['catequese', 'fieis', 'familias', 'comunidades'],
  membro:      ['pastorais', 'catequese', 'financeiro', 'patrimonio', 'fieis', 'familias', 'grupos', 'comunidades'],
};

// Labels exibidos na interface
export const LABEL_PAPEL: Record<PapelUsuario, string> = {
  admin:       'Administrador',
  paroquia:    'Pároco',
  vigario:     'Vigário',
  secretaria:  'Secretária(o)',
  tesoureiro:  'Tesoureiro(a)',
  catequista:  'Catequista',
  membro:      'Membro de Comunidade',
};

// Interface que define a estrutura de um utilizador no sistema
export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha?: string;
  nivel?: string;
  papel: PapelUsuario;
  comunidade_id?: number | null;
  comunidade_nome?: string | null;
}

// 🆕 Interface para o Cadastro e Controle de Bens Patrimoniais
export interface BemPatrimonial {
  id?: number; // Opcional porque não existe antes de salvar no banco
  nome: string; // Ex: "Veículo Paroquial", "Equipamento de Som"
  categoria: string; // Categoria livre digitada pelo usuário
  localizacao?: string; // Ex: "Salão Paroquial", "Secretaria"
  comunidade_id?: number; // ID da comunidade responsável (Chave Estrangeira)
  data_aquisicao?: string; // Data no formato texto (YYYY-MM-DD)
  valor_estimado?: number; // Valor decimal numérico para cálculos futuros
  estado_conservacao?: string; // Ex: "Excelente", "Bom", "Necessita Reparo"
  foto_path?: string; // Caminho local do arquivo de imagem no computador via Tauri
  documento_path?: string; // Caminho local da Nota Fiscal ou documento comprobatório
  observacoes?: string; // Informações adicionais livres
  created_at?: string; // Data de criação gerada automaticamente pelo SQLite
}

// 🆕 Interface para o Histórico de Manutenções de cada Bem
export interface ManutencaoBem {
  id?: number; // ID único da manutenção
  bem_id: number; // ID do bem a que esta manutenção pertence (Chave Estrangeira)
  data_manutencao: string; // Data em que o serviço foi realizado
  descricao: string; // Ex: "Troca de óleo", "Troca de conectores XLR"
  prestador_servico?: string; // Nome da empresa ou técnico que realizou o serviço
  valor_gasto?: number; // Custo monetário do reparo
  observacoes?: string; // Detalhes adicionais sobre o conserto
  created_at?: string; // Timestamp do registro
}