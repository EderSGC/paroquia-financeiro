import { getDb } from "@core/database";
import type { Paroquia, Usuario, PapelUsuario } from "../../../core/types/app.types";
import type { UsuarioRow, ConfiguracaoPartilha } from "../../../core/types/entities";
import { hashSenha, verificarSenha } from "../../../core/utils/crypto";
import { registrarAuditoria } from "@core/services/auditoria.service";
import { SECURITY } from "@core/config/constants";

const RATE_LIMIT_KEY = "paroquia_login_attempts";

function loadAttempts(): Map<string, { count: number; lockedUntil: number }> {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) return new Map();
    return new Map(Object.entries(JSON.parse(stored)));
  } catch {
    return new Map();
  }
}

function saveAttempts(map: Map<string, { count: number; lockedUntil: number }>): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch { /* ok */ }
}

function checkRateLimit(login: string): { blocked: boolean; remainingMs?: number } {
  const key = login.toLowerCase().trim();
  const loginAttempts = loadAttempts();
  const entry = loginAttempts.get(key);
  if (!entry) return { blocked: false };
  if (entry.lockedUntil > Date.now()) {
    return { blocked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
    saveAttempts(loginAttempts);
  }
  return { blocked: false };
}

function recordFailedAttempt(login: string): void {
  const key = login.toLowerCase().trim();
  const loginAttempts = loadAttempts();
  const entry = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= SECURITY.MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + SECURITY.LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(key, entry);
  saveAttempts(loginAttempts);
}

function clearAttempts(login: string): void {
  const loginAttempts = loadAttempts();
  loginAttempts.delete(login.toLowerCase().trim());
  saveAttempts(loginAttempts);
}

interface SetupInput {
  nome?: string; diocese?: string; cidade?: string; estado?: string;
  endereco?: string; cep?: string; email?: string; telefone?: string;
  cnpj?: string; logo_path?: string; diocese_logo_path?: string;
  login?: string; senha?: string;
  paroquia?: SetupInput;
  administrador?: { nome?: string; login?: string; senha?: string };
  usuario?: { nome?: string; login?: string; senha?: string };
}

interface ConfigParoquia {
  nome?: string; diocese?: string; cidade?: string; estado?: string;
  endereco?: string; cep?: string; email?: string; telefone?: string;
  cnpj?: string; logo_path?: string; diocese_logo_path?: string;
  confissoes_horario?: string; atendimento_horario?: string;
}

type AutenticacaoRow = UsuarioRow & { comunidade_nome?: string | null };

// ─── Configuração de Partilha ────────────────────────────────────────────────

export interface ConfigPartilha {
  comunidade: number;
  areaMissionaria: number;
  arquidiocese: number;
  fundoMissionario: number;
}

// ─── Migrações do banco de dados ─────────────────────────────────────────────

async function runMigrations(): Promise<void> {
  try {
    const db = await getDb();
    // Migrar dados: copiar email → login para registros antigos que usavam a coluna email
    await db.execute("UPDATE usuarios SET login = email WHERE (login IS NULL OR login = '') AND email IS NOT NULL AND email != ''").catch(() => {});
    // Seed da configuração de partilha (singleton – id sempre = 1)
    await db.execute(
      "INSERT OR IGNORE INTO configuracoes_partilha (id, comunidade, area_missionaria, arquidiocese, fundo_missionario) VALUES (1, 30.0, 40.0, 29.0, 1.0)"
    ).catch(() => {});
  } catch (err) {
    console.warn("runMigrations:", err);
  }
}

// ─── 1. BUSCA PARÓQUIA ATUAL ──────────────────────────────────────────────────

export async function getParoquiaAtual(): Promise<Paroquia | null> {
  try {
    await runMigrations();
    const db = await getDb();
    const res = await db.select<Paroquia[]>("SELECT * FROM paroquia LIMIT 1");
    if (res.length === 0) return null;
    // Se paróquia existe mas nenhum usuário foi criado com sucesso,
    // retorna null para forçar o setup completar o cadastro do admin.
    const usuarios = await db.select<{ id: number }[]>(
      "SELECT id FROM usuarios WHERE login IS NOT NULL AND login != '' LIMIT 1"
    );
    if (usuarios.length === 0) return null;
    return res[0];
  } catch (error) {
    console.error("Erro ao buscar paróquia:", error);
    return null;
  }
}

// ─── 2. AUTENTICAÇÃO ──────────────────────────────────────────────────────────

export async function autenticarUsuario(login: string, senha: string): Promise<Usuario | null> {
  try {
    if (!login || !senha) return null;

    const rl = checkRateLimit(login);
    if (rl.blocked) {
      const minutos = Math.ceil((rl.remainingMs ?? 0) / 60000);
      throw new Error(`Conta bloqueada por excesso de tentativas. Aguarde ${minutos} minuto(s).`);
    }

    const db = await getDb();
    const res = await db.select<AutenticacaoRow[]>(
      `SELECT u.*, c.nome AS comunidade_nome
       FROM usuarios u
       LEFT JOIN comunidades c ON c.id = u.comunidade_id
       WHERE LOWER(u.login) = LOWER(?) AND u.deleted_at IS NULL`,
      [login.trim()]
    );

    if (res.length === 0) {
      recordFailedAttempt(login);
      await registrarAuditoria({ usuario_id: 0, acao: "LOGIN", tabela: "sistema", descricao: `Tentativa de login falhou: usuário "${login}" não encontrado` });
      return null;
    }

    const u = res[0];
    const senhaOk = await verificarSenha(String(senha || "").trim(), String(u.senha || "").trim());

    if (!senhaOk) {
      recordFailedAttempt(login);
      await registrarAuditoria({ usuario_id: u.id, acao: "LOGIN", tabela: "sistema", descricao: `Tentativa de login falhou: senha incorreta para "${login}"` });
      return null;
    }

    clearAttempts(login);

    if (!String(u.senha || "").startsWith("pbkdf2$")) {
      try {
        const novaHash = await hashSenha(String(senha || "").trim());
        await db.execute("UPDATE usuarios SET senha=? WHERE id=?", [novaHash, u.id]);
      } catch { /* nunca bloqueia o login */ }
    }

    const usuario: Usuario = {
      id: u.id,
      nome: u.nome || "Usuário",
      login: u.login ?? "",
      nivel: u.nivel || "admin",
      papel: (u.papel as PapelUsuario) || 'paroquia',
      comunidade_id: u.comunidade_id ?? null,
      comunidade_nome: u.comunidade_nome ?? null,
    };

    await registrarAuditoria({ usuario_id: u.id, acao: "LOGIN", tabela: "sistema", descricao: `Login bem-sucedido: ${usuario.nome} (${usuario.papel})` });

    return usuario;
  } catch (error) {
    if ((error as Error).message?.includes("bloqueada")) throw error;
    console.error("Erro ao autenticar:", error);
    return null;
  }
}

export async function registrarLogout(usuarioId: number, nome: string): Promise<void> {
  await registrarAuditoria({ usuario_id: usuarioId, acao: "LOGOUT", tabela: "sistema", descricao: `Logout: ${nome}` });
}

// ─── 3. SETUP INICIAL ─────────────────────────────────────────────────────────

export async function finalizarSetup(arg1: SetupInput, arg2?: SetupInput): Promise<void> {
  try {
    const db = await getDb();
    let p = arg1 || {};
    let u = arg2 || arg1?.administrador || arg1?.usuario || arg1 || {};
    if (!arg2 && arg1) { p = arg1.paroquia || arg1; }

    const pNome = (p.nome || "Paróquia").trim();
    const pDiocese = (p.diocese || "").trim();
    const pCidade = (p.cidade || "").trim();
    const pEstado = (p.estado || "").trim();
    const pEndereco = (p.endereco || "").trim();
    const pCep = (p.cep || "").trim();
    const pEmail = (p.email || "").trim();
    const pTelefone = (p.telefone || "").trim();
    const pCnpj = (p.cnpj || "").trim();
    const pLogoPath = p.logo_path || "";
    const pDioceseLogoPath = p.diocese_logo_path || "";

    const uNome = (u.nome || "Admin").trim();
    const uLogin = (u.login || "admin").trim();
    const uSenhaRaw = (u.senha || "").trim();
    if (!uSenhaRaw || uSenhaRaw.length < SECURITY.MIN_PASSWORD_LENGTH) {
      throw new Error(`Senha é obrigatória e deve ter no mínimo ${SECURITY.MIN_PASSWORD_LENGTH} caracteres`);
    }
    const uSenha = await hashSenha(uSenhaRaw);

    if (!pNome) throw new Error("Nome da paróquia é obrigatório");
    if (!uNome || !uLogin || !uSenha) throw new Error("Dados do administrador incompletos");

    const paroquiaExistente = await db.select<{ id: number }[]>("SELECT id FROM paroquia LIMIT 1");
    if (paroquiaExistente.length > 0) {
      await db.execute(
        "UPDATE paroquia SET nome=?,diocese=?,cidade=?,estado=?,endereco=?,cep=?,email=?,telefone=?,cnpj=?,logo_path=?,diocese_logo_path=? WHERE id=?",
        [pNome,pDiocese,pCidade,pEstado,pEndereco,pCep,pEmail,pTelefone,pCnpj,pLogoPath,pDioceseLogoPath,paroquiaExistente[0].id]
      );
    } else {
      await db.execute(
        "INSERT INTO paroquia (nome,diocese,cidade,estado,endereco,cep,email,telefone,cnpj,logo_path,diocese_logo_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [pNome,pDiocese,pCidade,pEstado,pEndereco,pCep,pEmail,pTelefone,pCnpj,pLogoPath,pDioceseLogoPath]
      );
    }

    const usuarioExistente = await db.select<{ id: number }[]>("SELECT id FROM usuarios WHERE LOWER(login)=LOWER(?)", [uLogin]);
    if (usuarioExistente.length > 0) {
      await db.execute(
        "UPDATE usuarios SET nome=?,senha=?,nivel=?,papel=? WHERE id=?",
        [uNome, uSenha, "admin", "admin", usuarioExistente[0].id]
      );
    } else {
      try {
        await db.execute(
          "INSERT INTO usuarios (nome,login,senha,nivel,papel) VALUES (?,?,?,?,?)",
          [uNome, uLogin, uSenha, "admin", "admin"]
        );
      } catch {
        await db.execute(
          "INSERT INTO usuarios (nome,login,senha) VALUES (?,?,?)",
          [uNome, uLogin, uSenha]
        );
      }
    }
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch (error) {
    console.error("Erro no setup:", error);
    throw error;
  }
}

// ─── 4. ATUALIZAR CONFIGURAÇÕES DA PARÓQUIA ───────────────────────────────────

export async function salvarConfiguracoesParoquia(dados: ConfigParoquia): Promise<void> {
  try {
    const db = await getDb();
    const d = dados || {};
    await db.execute(
      "UPDATE paroquia SET nome=?,diocese=?,cidade=?,estado=?,endereco=?,cep=?,email=?,telefone=?,cnpj=?,logo_path=?,diocese_logo_path=?,confissoes_horario=?,atendimento_horario=? WHERE id=(SELECT id FROM paroquia LIMIT 1)",
      [d.nome||"",d.diocese||"",d.cidade||"",d.estado||"",d.endereco||"",d.cep||"",d.email||"",d.telefone||"",d.cnpj||"",d.logo_path||"",d.diocese_logo_path||"",d.confissoes_horario||"",d.atendimento_horario||""]
    );
  } catch (error) { throw error; }
}

// ─── 5. REDEFINIR SENHA ───────────────────────────────────────────────────────

export async function redefinirSenha(login: string, nomeCompleto: string, novaSenha: string, respostaSeguranca?: string): Promise<boolean> {
  try {
    if (!login || !nomeCompleto || !novaSenha) return false;
    if (novaSenha.trim().length < SECURITY.MIN_PASSWORD_LENGTH) return false;
    const db = await getDb();
    const res = await db.select<UsuarioRow[]>("SELECT * FROM usuarios WHERE LOWER(login)=LOWER(?) AND deleted_at IS NULL", [login.trim()]);
    if (res.length === 0) {
      await registrarAuditoria({ usuario_id: 0, acao: "ALTERACAO", tabela: "usuarios", descricao: `Tentativa de reset de senha: login "${login}" não encontrado` });
      return false;
    }
    const usuario = res[0];
    if ((usuario.nome||"").trim().toLowerCase() !== (nomeCompleto||"").trim().toLowerCase()) {
      await registrarAuditoria({ usuario_id: usuario.id, acao: "ALTERACAO", tabela: "usuarios", registro_id: usuario.id, descricao: `Tentativa de reset de senha: nome não confere para "${login}"` });
      return false;
    }
    const respostaDb = (usuario as unknown as Record<string, unknown>).resposta_seguranca as string | null;
    if (respostaDb) {
      if (!respostaSeguranca || respostaSeguranca.trim().toLowerCase() !== respostaDb.trim().toLowerCase()) {
        await registrarAuditoria({ usuario_id: usuario.id, acao: "ALTERACAO", tabela: "usuarios", registro_id: usuario.id, descricao: `Tentativa de reset de senha: resposta de segurança incorreta para "${login}"` });
        return false;
      }
    }
    await db.execute("UPDATE usuarios SET senha=? WHERE id=?", [await hashSenha(novaSenha.trim()), usuario.id]);
    await registrarAuditoria({ usuario_id: usuario.id, acao: "ALTERACAO", tabela: "usuarios", registro_id: usuario.id, descricao: `Senha redefinida para "${login}"` });
    return true;
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    return false;
  }
}

export async function verificarPerguntaSeguranca(login: string): Promise<string | null> {
  try {
    const db = await getDb();
    const res = await db.select<Record<string, unknown>[]>(
      "SELECT pergunta_seguranca FROM usuarios WHERE LOWER(login)=LOWER(?) AND deleted_at IS NULL",
      [login.trim()]
    );
    if (res.length === 0) return null;
    return (res[0].pergunta_seguranca as string) || null;
  } catch { return null; }
}

export async function salvarPerguntaSeguranca(usuarioId: number, pergunta: string, resposta: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE usuarios SET pergunta_seguranca=?, resposta_seguranca=? WHERE id=?",
    [pergunta.trim(), resposta.trim().toLowerCase(), usuarioId]
  );
}

// ─── 6. GESTÃO DE USUÁRIOS (admin) ───────────────────────────────────────────

export interface UsuarioListItem {
  id: number;
  nome: string;
  login: string;
  papel: PapelUsuario;
  comunidade_id: number | null;
  comunidade_nome: string | null;
}

export async function listarUsuarios(): Promise<UsuarioListItem[]> {
  const db = await getDb();
  return db.select<UsuarioListItem[]>(`
    SELECT u.id, u.nome, u.login,
           COALESCE(u.papel, 'paroquia') AS papel,
           u.comunidade_id,
           c.nome AS comunidade_nome
    FROM usuarios u
    LEFT JOIN comunidades c ON c.id = u.comunidade_id
    WHERE u.deleted_at IS NULL
    ORDER BY u.nome ASC
  `);
}

export async function criarUsuario(dados: {
  nome: string;
  login: string;
  senha: string;
  papel: PapelUsuario;
  comunidade_id?: number | null;
}): Promise<void> {
  const db = await getDb();
  const senhaHash = await hashSenha(dados.senha);
  const nivel = ['admin','paroquia','vigario','secretaria'].includes(dados.papel) ? 'admin' : 'user';
  await db.execute(
    "INSERT INTO usuarios (nome,login,senha,nivel,papel,comunidade_id) VALUES (?,?,?,?,?,?)",
    [dados.nome, dados.login, senhaHash, nivel, dados.papel, dados.comunidade_id ?? null]
  );
}

export async function excluirUsuario(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE usuarios SET deleted_at = CURRENT_TIMESTAMP WHERE id=?", [id]);
}

// ─── 9. CONFIGURAÇÃO DA PARTILHA ─────────────────────────────────────────────

export async function carregarPartilha(): Promise<ConfigPartilha> {
  try {
    const db = await getDb();
    const res = await db.select<ConfiguracaoPartilha[]>("SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1");
    if (res.length > 0) {
      return {
        comunidade:       Number(res[0].comunidade)       || 30,
        areaMissionaria:  Number(res[0].area_missionaria)  || 40,
        arquidiocese:     Number(res[0].arquidiocese)      || 29,
        fundoMissionario: Number(res[0].fundo_missionario) || 1,
      };
    }
  } catch { /* retorna padrão */ }
  return { comunidade: 30, areaMissionaria: 40, arquidiocese: 29, fundoMissionario: 1 };
}

export async function salvarPartilha(config: ConfigPartilha): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE configuracoes_partilha SET comunidade=?,area_missionaria=?,arquidiocese=?,fundo_missionario=? WHERE id=1",
    [config.comunidade, config.areaMissionaria, config.arquidiocese, config.fundoMissionario]
  );
}
