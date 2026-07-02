/**
 * Validadores de Dados Paroquiais
 */

export interface ValidationResult {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

interface ParoquiaInput {
  nome?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cnpj?: string;
}

interface UsuarioInput {
  nome?: string;
  login?: string;
  senha?: string;
}

/**
 * Validar dados da Paróquia
 */
export function validarParoquia(data: ParoquiaInput): ValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!data.nome || data.nome.trim() === "") {
    erros.push("Nome da paróquia é obrigatório");
  }

  if (!data.email || data.email.trim() === "") {
    avisos.push("Email não informado");
  } else if (!isValidEmail(data.email)) {
    erros.push("Email inválido");
  }

  if (!data.telefone || data.telefone.trim() === "") {
    avisos.push("Telefone não informado");
  }

  if (!data.endereco || data.endereco.trim() === "") {
    avisos.push("Endereço não informado");
  }

  if (!data.cnpj || data.cnpj.trim() === "") {
    avisos.push("CNPJ não informado");
  } else if (!isValidCNPJ(data.cnpj)) {
    avisos.push("CNPJ pode ser inválido");
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

/**
 * Validar dados do Usuário
 */
export function validarUsuario(data: UsuarioInput): ValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!data.nome || data.nome.trim() === "") {
    erros.push("Nome completo é obrigatório");
  } else if (data.nome.trim().length < 3) {
    erros.push("Nome deve ter pelo menos 3 caracteres");
  }

  if (!data.login || data.login.trim() === "") {
    erros.push("Login é obrigatório");
  } else if (data.login.trim().length < 3) {
    erros.push("Login deve ter pelo menos 3 caracteres");
  } else if (!/^[a-z0-9._-]+$/.test(data.login.trim())) {
    erros.push("Login deve conter apenas letras, números, pontos, hífens e sublinhados");
  }

  if (!data.senha || data.senha.trim() === "") {
    erros.push("Senha é obrigatória");
  } else if (data.senha.length < 6) {
    erros.push("Senha deve ter no mínimo 6 caracteres");
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

/**
 * Validar email
 */
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validar CNPJ (simples)
 */
function isValidCNPJ(cnpj: string): boolean {
  // Remove caracteres especiais
  const cleaned = cnpj.replace(/\D/g, "");
  
  // Validação básica de comprimento
  if (cleaned.length !== 14) {
    return false;
  }

  // Não é um CNPJ válido se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleaned)) {
    return false;
  }

  return true;
}

/**
 * Normaliza texto para comparação de duplicatas.
 * Remove acentos, lowercase, trim, colapsa espaços.
 */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Validar CPF com dígitos verificadores.
 * Retorna true se vazio (CPF é opcional) ou se válido.
 */
export function isValidCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length === 0) return true;
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(d[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(d[10])) return false;

  return true;
}

/**
 * Sanitizar entrada de texto
 */
export function sanitizarTexto(text: string): string {
  return text
    .trim()
    .replace(/[<>]/g, "") // Remove < e >
    .substring(0, 255); // Limita a 255 caracteres
}

/**
 * Sanitizar login
 */
export function sanitizarLogin(login: string): string {
  return login
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .substring(0, 50);
}

/**
 * Formatar CNPJ
 */
export function formatarCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
}

/**
 * Formatar CEP
 */
export function formatarCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return cep;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
}
