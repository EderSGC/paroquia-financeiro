import { getDb } from "@core/database";

// ─── Tipos do perfil consolidado ──────────────────────────────────────────────

export interface FielProfile {
  id: number;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cpf: string | null;
  comunidade: string | null;
  comunidade_id: number | null;
  isDizimista: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface FielIndicadores {
  isDizimista: boolean;
  isCatequizando: boolean;
  isCatequista: boolean;
  isAgentePastoral: boolean;
  isResponsavelFamiliar: boolean;
}

export interface FielResumoPastoral {
  sacramentos: number;
  pastorais: number;
  gruposMovimentos: number;
  registrosFinanceiros: number;
  documentosEmitidos: number;
}

export interface FielSacramento {
  id: number;
  tipo: string;
  data_sacramento: string | null;
  celebrante: string | null;
  comunidade: string | null;
  livro: string | null;
  folha: string | null;
  assento: string | null;
}

export interface FielCatequese {
  id: number;
  turma: string;
  etapa: string;
  ano: number;
  situacao: string | null;
}

export interface FielPastoral {
  id: number;
  nome: string;
  cargo: string | null;
  tipo: "pastoral" | "grupo";
  vinculado_em?: string | null;
}

export interface FielFamilia {
  familia_id: number;
  sobrenome: string;
  parentesco: string | null;
  membros: { id: number; nome: string; parentesco: string | null }[];
}

export interface FielFinanceiro {
  totalContribuicoes: number;
  ultimaContribuicao: string | null;
  countContribuicoes: number;
}

export interface FielDocumento {
  id: number;
  tipo: string;
  numero_protocolo: string | null;
  data_emissao: string | null;
  assunto: string | null;
}

export interface FielObservacao {
  id: number;
  autor: string | null;
  tipo: string | null;
  texto: string;
  created_at: string;
}

export interface TimelineEvent {
  data: string;
  tipo: string;
  descricao: string;
  icone: string;
  cor: string;
  modulo: string;
}

export interface FielProfileCompleto {
  fiel: FielProfile;
  indicadores: FielIndicadores;
  resumo: FielResumoPastoral;
  sacramentos: FielSacramento[];
  catequese: FielCatequese[];
  pastorais: FielPastoral[];
  familia: FielFamilia | null;
  financeiro: FielFinanceiro;
  documentos: FielDocumento[];
  observacoes: FielObservacao[];
  timeline: TimelineEvent[];
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export const FielProfileService = {

  async carregarPerfil(fielId: number): Promise<FielProfileCompleto> {
    const db = await getDb();

    // 1. Dados básicos do fiel
    const fielRows = await db.select<FielProfile[]>(
      'SELECT id, nome, data_nascimento, telefone, email, endereco, cpf, comunidade, comunidade_id, isDizimista, created_at, updated_at FROM fieis WHERE id = $1',
      [fielId]
    );
    if (fielRows.length === 0) throw new Error(`Fiel ${fielId} não encontrado`);
    const fiel = fielRows[0];

    // 2. Executar todas as queries em paralelo
    const [
      sacramentos, catequese, pastoraisData, gruposData,
      familiaData, financeiro, documentos, observacoes,
      isCatequistaRows, isResponsavelRows,
    ] = await Promise.all([
      // Sacramentos
      db.select<FielSacramento[]>(
        'SELECT id, tipo, data_sacramento, celebrante, comunidade, livro, folha, assento FROM sacramentos_registros WHERE fiel_id = $1 AND deleted_at IS NULL ORDER BY data_sacramento ASC LIMIT 100',
        [fielId]
      ).catch(() => [] as FielSacramento[]),

      // Catequese (matrículas + turma)
      db.select<FielCatequese[]>(
        `SELECT m.id, t.nome as turma, t.etapa, t.ano, m.situacao
         FROM catequese_matriculas m
         JOIN catequese_turmas t ON t.id = m.turma_id
         WHERE m.fiel_id = $1 AND m.deleted_at IS NULL
         ORDER BY t.ano DESC`,
        [fielId]
      ).catch(() => [] as FielCatequese[]),

      // Pastorais (via coordenação direta)
      db.select<{ id: number; nome: string; cargo: string }[]>(
        `SELECT id, nome,
           CASE
             WHEN coordenador_id = $1 THEN 'Coordenador(a)'
             WHEN vice_id = $1 THEN 'Vice-coordenador(a)'
             WHEN secretario_id = $1 THEN 'Secretário(a)'
             WHEN tesoureiro_id = $1 THEN 'Tesoureiro(a)'
             ELSE 'Membro'
           END as cargo
         FROM pastorais
         WHERE deleted_at IS NULL AND (coordenador_id=$1 OR vice_id=$1 OR secretario_id=$1 OR tesoureiro_id=$1)`,
        [fielId]
      ).catch(() => []),

      // Grupos (via grupo_membros)
      db.select<{ id: number; nome: string; cargo: string | null; vinculado_em: string | null }[]>(
        `SELECT g.id, g.nome, gm.cargo, gm.created_at as vinculado_em
         FROM grupo_membros gm
         JOIN grupos g ON g.id = gm.grupo_id
         WHERE gm.fiel_id = $1 AND g.deleted_at IS NULL
         ORDER BY g.nome`,
        [fielId]
      ).catch(() => []),

      // Família
      db.select<{ familia_id: number; sobrenome: string; parentesco: string | null }[]>(
        `SELECT mf.familia_id, f.sobrenome, mf.parentesco
         FROM membros_familia mf
         JOIN familias f ON f.id = mf.familia_id
         WHERE mf.fiel_id = $1 AND (mf.deleted_at IS NULL) AND (f.deleted_at IS NULL)
         LIMIT 1`,
        [fielId]
      ).catch(() => []),

      // Financeiro (agregado)
      db.select<{ total: number; ultima: string | null; count: number }[]>(
        `SELECT COALESCE(SUM(valor),0) as total,
                MAX(data) as ultima,
                COUNT(*) as count
         FROM lancamentos
         WHERE fiel_id = $1 AND deleted_at IS NULL AND tipo = 'ENTRADA'`,
        [fielId]
      ).catch(() => [{ total: 0, ultima: null, count: 0 }]),

      // Documentos
      db.select<FielDocumento[]>(
        `SELECT id, tipo, numero_protocolo, data_emissao, assunto
         FROM documentos_registros
         WHERE deleted_at IS NULL AND (
           json_extract(json_dados, '$.fiel_id') = CAST($1 AS TEXT)
           OR json_extract(json_dados, '$.fielId') = CAST($1 AS TEXT)
           OR json_extract(json_dados, '$.nomeBatizando') = $2
           OR json_extract(json_dados, '$.nome') = $2
         )
         ORDER BY data_emissao DESC LIMIT 50`,
        [fielId, fiel.nome]
      ).catch(() => [] as FielDocumento[]),

      // Observações
      db.select<FielObservacao[]>(
        'SELECT id, autor, tipo, texto, created_at FROM observacoes_pastorais WHERE fiel_id = $1 ORDER BY created_at DESC LIMIT 50',
        [fielId]
      ).catch(() => [] as FielObservacao[]),

      // Indicador: catequista
      db.select<{ id: number }[]>(
        'SELECT id FROM catequistas WHERE fiel_id = $1 AND deleted_at IS NULL LIMIT 1',
        [fielId]
      ).catch(() => []),

      // Indicador: responsável familiar
      db.select<{ id: number }[]>(
        'SELECT id FROM familias WHERE responsavel_id = $1 AND deleted_at IS NULL LIMIT 1',
        [fielId]
      ).catch(() => []),
    ]);

    // 3. Montar pastorais unificadas
    const pastorais: FielPastoral[] = [
      ...pastoraisData.map(p => ({ ...p, tipo: "pastoral" as const, vinculado_em: null })),
      ...gruposData.map(g => ({ id: g.id, nome: g.nome, cargo: g.cargo, tipo: "grupo" as const, vinculado_em: g.vinculado_em ?? null })),
    ];

    // 4. Montar família com membros
    let familia: FielFamilia | null = null;
    if (familiaData.length > 0) {
      const fam = familiaData[0];
      const membrosRows = await db.select<{ fiel_id: number; nome: string; parentesco: string | null }[]>(
        `SELECT mf.fiel_id as id, f.nome, mf.parentesco
         FROM membros_familia mf
         JOIN fieis f ON f.id = mf.fiel_id
         WHERE mf.familia_id = $1 AND mf.fiel_id != $2 AND mf.deleted_at IS NULL AND f.deleted_at IS NULL
         ORDER BY f.nome`,
        [fam.familia_id, fielId]
      ).catch(() => []);
      familia = {
        familia_id: fam.familia_id,
        sobrenome: fam.sobrenome,
        parentesco: fam.parentesco,
        membros: membrosRows.map(m => ({ id: m.fiel_id, nome: m.nome, parentesco: m.parentesco })),
      };
    }

    // 5. Financeiro
    const fin = financeiro[0] ?? { total: 0, ultima: null, count: 0 };
    const fielFinanceiro: FielFinanceiro = {
      totalContribuicoes: fin.total,
      ultimaContribuicao: fin.ultima,
      countContribuicoes: fin.count,
    };

    // 6. Indicadores
    const indicadores: FielIndicadores = {
      isDizimista: Number(fiel.isDizimista) === 1,
      isCatequizando: catequese.some(c => c.situacao && !['CONCLUIDO', 'CANCELADO'].includes(c.situacao)),
      isCatequista: isCatequistaRows.length > 0,
      isAgentePastoral: pastorais.length > 0,
      isResponsavelFamiliar: isResponsavelRows.length > 0,
    };

    // 7. Resumo
    const resumo: FielResumoPastoral = {
      sacramentos: sacramentos.length,
      pastorais: pastoraisData.length,
      gruposMovimentos: gruposData.length,
      registrosFinanceiros: fin.count,
      documentosEmitidos: documentos.length,
    };

    // 8. Timeline unificada
    const timeline = FielProfileService.montarTimeline(sacramentos, catequese, pastorais, fielFinanceiro, documentos, fiel);

    return {
      fiel, indicadores, resumo, sacramentos, catequese,
      pastorais, familia, financeiro: fielFinanceiro,
      documentos, observacoes, timeline,
    };
  },

  montarTimeline(
    sacramentos: FielSacramento[],
    catequese: FielCatequese[],
    pastorais: FielPastoral[],
    financeiro: FielFinanceiro,
    documentos: FielDocumento[],
    fiel: FielProfile,
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    if (fiel.created_at) {
      events.push({
        data: fiel.created_at.slice(0, 10),
        tipo: "Cadastro",
        descricao: "Cadastro na paróquia",
        icone: "user-plus", cor: "#007AFF", modulo: "pastoral",
      });
    }

    for (const s of sacramentos) {
      if (!s.data_sacramento) continue;
      const nomes: Record<string, string> = {
        BATISMO: "Batismo", EUCARISTIA: "1ª Eucaristia", CRISMA: "Crisma",
        MATRIMONIO: "Matrimônio", CERT_BATISMO: "Certidão de Batismo",
        CERT_CRISMA: "Certidão de Crisma", CERT_MATRIMONIO: "Certidão de Matrimônio",
      };
      events.push({
        data: s.data_sacramento,
        tipo: nomes[s.tipo] ?? s.tipo,
        descricao: `${nomes[s.tipo] ?? s.tipo}${s.celebrante ? ` — Cel. ${s.celebrante}` : ""}`,
        icone: "cross", cor: "#AF52DE", modulo: "sacramental",
      });
    }

    for (const c of catequese) {
      events.push({
        data: `${c.ano}-01-01`,
        tipo: "Catequese",
        descricao: `${c.etapa} — ${c.turma}${c.situacao ? ` (${c.situacao})` : ""}`,
        icone: "book", cor: "#FF9500", modulo: "catequese",
      });
    }

    for (const p of pastorais) {
      const dataVinculo = p.vinculado_em?.slice(0, 10) || fiel.created_at?.slice(0, 10) || "";
      if (!dataVinculo) continue;
      events.push({
        data: dataVinculo,
        tipo: p.tipo === "pastoral" ? "Pastoral" : "Grupo",
        descricao: `${p.nome}${p.cargo ? ` — ${p.cargo}` : ""}`,
        icone: "users", cor: "#34C759", modulo: "pastoral",
      });
    }

    for (const d of documentos) {
      if (!d.data_emissao) continue;
      events.push({
        data: d.data_emissao,
        tipo: "Documento",
        descricao: `${d.tipo}${d.assunto ? ` — ${d.assunto}` : ""}`,
        icone: "file-text", cor: "#5856D6", modulo: "documentos",
      });
    }

    if (financeiro.ultimaContribuicao) {
      events.push({
        data: financeiro.ultimaContribuicao,
        tipo: "Dízimo",
        descricao: `Última contribuição — ${financeiro.countContribuicoes} registro(s)`,
        icone: "heart-handshake", cor: "#FF2D55", modulo: "financeiro",
      });
    }

    events.sort((a, b) => (a.data > b.data ? 1 : a.data < b.data ? -1 : 0));
    return events;
  },

  async adicionarObservacao(fielId: number, texto: string, autor: string, tipo = "GERAL"): Promise<void> {
    const textoLimpo = texto?.trim();
    if (!textoLimpo) throw new Error("Texto da observação não pode ser vazio");
    if (!fielId || fielId <= 0) throw new Error("fiel_id inválido");
    const db = await getDb();
    await db.execute(
      'INSERT INTO observacoes_pastorais (fiel_id, autor, tipo, texto) VALUES ($1, $2, $3, $4)',
      [fielId, autor || "Sistema", tipo, textoLimpo]
    );
  },

  async removerObservacao(id: number, fielId: number): Promise<void> {
    if (!id || !fielId) throw new Error("id e fiel_id são obrigatórios");
    const db = await getDb();
    await db.execute('DELETE FROM observacoes_pastorais WHERE id = $1 AND fiel_id = $2', [id, fielId]);
  },
};
