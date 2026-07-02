import { getDb } from "@core/database";
import { PastoralRepository } from "@core/repository/pastoral.repository";
import { isValidCPF, normalizeText } from "@core/utils/validators";

export interface CreateFielInput {
  nome: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cpf?: string;
  comunidade?: string;
  isDizimista?: boolean;
}

interface FielRow {
  id: number;
  nome: string;
  telefone?: string | null;
  data_nascimento?: string | null;
  cpf?: string | null;
}

function normalize(s: string | undefined | null): string {
  return normalizeText(s ?? "");
}

function normalizeCpf(s: string | undefined | null): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Autoridade única para criação e deduplicação de Fiéis.
 *
 * Regra: NENHUM módulo pode fazer INSERT INTO fieis diretamente.
 * Toda criação passa por este serviço.
 */
export const FielService = {
  async findDuplicate(input: CreateFielInput): Promise<number | null> {
    const db = await getDb();

    const cpfNorm = normalizeCpf(input.cpf);
    if (cpfNorm.length >= 11) {
      const byCpf = await db.select<FielRow[]>(
        "SELECT id FROM fieis WHERE deleted_at IS NULL AND REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','') = $1 LIMIT 1",
        [cpfNorm]
      );
      if (byCpf.length > 0) return byCpf[0].id;
    }

    const nomeNorm = normalize(input.nome);
    if (!nomeNorm) return null;

    const candidates = await db.select<FielRow[]>(
      "SELECT id, nome, telefone, data_nascimento FROM fieis WHERE deleted_at IS NULL AND LOWER(TRIM(nome)) = $1",
      [nomeNorm]
    );

    if (candidates.length === 0) return null;

    const telNorm = normalize(input.telefone)?.replace(/\D/g, "");

    for (const c of candidates) {
      const cTel = normalize(c.telefone)?.replace(/\D/g, "");
      if (telNorm && cTel && telNorm === cTel) return c.id;
      if (input.data_nascimento && c.data_nascimento &&
          input.data_nascimento === c.data_nascimento) return c.id;
    }

    return null;
  },

  async createFiel(input: CreateFielInput): Promise<{ id: number; created: boolean; cpfInvalido?: boolean }> {
    if (input.cpf && !isValidCPF(input.cpf)) {
      return { id: -1, created: false, cpfInvalido: true };
    }

    const existingId = await FielService.findDuplicate(input);
    if (existingId) {
      console.warn(`FielService: fiel duplicado detectado (id=${existingId}), retornando existente`);
      return { id: existingId, created: false };
    }

    let comunidadeId: number | null = null;
    if (input.comunidade) {
      const db = await getDb();
      const rows = await db.select<{ id: number }[]>(
        "SELECT id FROM comunidades WHERE LOWER(TRIM(nome))=LOWER(TRIM($1)) AND deleted_at IS NULL LIMIT 1",
        [input.comunidade]
      );
      comunidadeId = rows[0]?.id ?? null;
    }

    const id = await PastoralRepository.fieis.create({
      nome: input.nome.trim(),
      data_nascimento: input.data_nascimento || "",
      telefone: input.telefone || "",
      email: input.email || "",
      endereco: input.endereco || "",
      cpf: input.cpf || "",
      comunidade_id: comunidadeId,
      comunidade: input.comunidade || "",
      isDizimista: input.isDizimista ? 1 : 0,
    } as any);

    return { id, created: true };
  },

  async findOrCreate(input: CreateFielInput): Promise<{ id: number; created: boolean; cpfInvalido?: boolean }> {
    return FielService.createFiel(input);
  },

  async restore(id: number): Promise<void> {
    await PastoralRepository.fieis.restore(id);
  },
};
