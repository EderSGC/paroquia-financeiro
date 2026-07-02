import { getDb } from "@core/database";

export interface RelatorioFieisPorComunidade {
  comunidade: string;
  total: number;
  dizimistas: number;
  fieis: { nome: string; telefone: string | null; data_nascimento: string | null }[];
}

export interface RelatorioFieisPorFaixaEtaria {
  faixa: string;
  total: number;
}

export interface RelatorioSacramentosPeriodo {
  tipo: string;
  total: number;
  registros: { nome_principal: string; data_sacramento: string; celebrante: string | null; comunidade: string | null }[];
}

export interface RelatorioFinanceiroMensal {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
  porCategoria: { categoria: string; valor: number }[];
}

export interface RelatorioCatequeseTurma {
  turma: string;
  etapa: string;
  ano: number;
  catequista: string | null;
  matriculados: number;
  concluidos: number;
  ativos: number;
}

export const RelatorioService = {

  async fieisPorComunidade(): Promise<RelatorioFieisPorComunidade[]> {
    const db = await getDb();
    const comunidades = await db.select<{ comunidade: string; total: number; dizimistas: number }[]>(`
      SELECT COALESCE(comunidade, 'Sem comunidade') as comunidade,
             COUNT(*) as total,
             SUM(CASE WHEN isDizimista = 1 THEN 1 ELSE 0 END) as dizimistas
      FROM fieis WHERE deleted_at IS NULL
      GROUP BY comunidade ORDER BY total DESC
    `);

    const result: RelatorioFieisPorComunidade[] = [];
    for (const c of comunidades) {
      const fieis = await db.select<{ nome: string; telefone: string | null; data_nascimento: string | null }[]>(
        `SELECT nome, telefone, data_nascimento FROM fieis
         WHERE deleted_at IS NULL AND COALESCE(comunidade,'Sem comunidade') = ?
         ORDER BY nome ASC LIMIT 500`,
        [c.comunidade]
      );
      result.push({ ...c, fieis });
    }
    return result;
  },

  async fieisPorFaixaEtaria(): Promise<RelatorioFieisPorFaixaEtaria[]> {
    const db = await getDb();
    return db.select<RelatorioFieisPorFaixaEtaria[]>(`
      SELECT
        CASE
          WHEN data_nascimento IS NULL OR data_nascimento = '' THEN 'Não informado'
          WHEN CAST((julianday('now') - julianday(data_nascimento))/365.25 AS INTEGER) < 13 THEN '0–12 (Criança)'
          WHEN CAST((julianday('now') - julianday(data_nascimento))/365.25 AS INTEGER) < 18 THEN '13–17 (Adolescente)'
          WHEN CAST((julianday('now') - julianday(data_nascimento))/365.25 AS INTEGER) < 30 THEN '18–29 (Jovem)'
          WHEN CAST((julianday('now') - julianday(data_nascimento))/365.25 AS INTEGER) < 60 THEN '30–59 (Adulto)'
          ELSE '60+ (Idoso)'
        END as faixa,
        COUNT(*) as total
      FROM fieis WHERE deleted_at IS NULL
      GROUP BY faixa ORDER BY
        CASE faixa
          WHEN '0–12 (Criança)' THEN 1
          WHEN '13–17 (Adolescente)' THEN 2
          WHEN '18–29 (Jovem)' THEN 3
          WHEN '30–59 (Adulto)' THEN 4
          WHEN '60+ (Idoso)' THEN 5
          ELSE 6
        END
    `);
  },

  async sacramentosPorPeriodo(dataInicio: string, dataFim: string): Promise<RelatorioSacramentosPeriodo[]> {
    const db = await getDb();
    const tipos = await db.select<{ tipo: string; total: number }[]>(
      `SELECT tipo, COUNT(*) as total FROM sacramentos_registros
       WHERE deleted_at IS NULL AND data_sacramento BETWEEN ? AND ?
       GROUP BY tipo ORDER BY total DESC`,
      [dataInicio, dataFim]
    );

    const result: RelatorioSacramentosPeriodo[] = [];
    for (const t of tipos) {
      const registros = await db.select<{ nome_principal: string; data_sacramento: string; celebrante: string | null; comunidade: string | null }[]>(
        `SELECT nome_principal, data_sacramento, celebrante, comunidade
         FROM sacramentos_registros
         WHERE tipo = ? AND deleted_at IS NULL AND data_sacramento BETWEEN ? AND ?
         ORDER BY data_sacramento ASC LIMIT 500`,
        [t.tipo, dataInicio, dataFim]
      );
      result.push({ ...t, registros });
    }
    return result;
  },

  async financeiroMensal(ano: number): Promise<RelatorioFinanceiroMensal[]> {
    const db = await getDb();
    const meses = await db.select<{ mes: string; entradas: number; saidas: number }[]>(`
      SELECT substr(data, 1, 7) as mes,
             COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END), 0) as entradas,
             COALESCE(SUM(CASE WHEN tipo='SAIDA' THEN valor ELSE 0 END), 0) as saidas
      FROM lancamentos
      WHERE deleted_at IS NULL AND substr(data, 1, 4) = ?
      GROUP BY mes ORDER BY mes ASC`,
      [String(ano)]
    );

    const result: RelatorioFinanceiroMensal[] = [];
    for (const m of meses) {
      const porCategoria = await db.select<{ categoria: string; valor: number }[]>(
        `SELECT COALESCE(categoria, 'Sem categoria') as categoria,
                SUM(valor) as valor
         FROM lancamentos
         WHERE deleted_at IS NULL AND substr(data, 1, 7) = ?
         GROUP BY categoria ORDER BY valor DESC LIMIT 20`,
        [m.mes]
      );
      result.push({
        mes: m.mes,
        entradas: m.entradas,
        saidas: m.saidas,
        saldo: m.entradas - m.saidas,
        porCategoria,
      });
    }
    return result;
  },

  async catequeseTurmas(ano?: number): Promise<RelatorioCatequeseTurma[]> {
    const db = await getDb();
    const anoFiltro = ano ?? new Date().getFullYear();
    return db.select<RelatorioCatequeseTurma[]>(`
      SELECT t.nome as turma, t.etapa, t.ano, t.nome_catequista as catequista,
             COUNT(m.id) as matriculados,
             SUM(CASE WHEN m.situacao = 'CONCLUIDO' THEN 1 ELSE 0 END) as concluidos,
             SUM(CASE WHEN m.situacao NOT IN ('CONCLUIDO','CANCELADO') THEN 1 ELSE 0 END) as ativos
      FROM catequese_turmas t
      LEFT JOIN catequese_matriculas m ON m.turma_id = t.id AND m.deleted_at IS NULL
      WHERE t.deleted_at IS NULL AND t.ano = ?
      GROUP BY t.id ORDER BY t.etapa, t.nome`,
      [anoFiltro]
    );
  },

  async resumoGeral(): Promise<{
    totalFieis: number;
    totalDizimistas: number;
    totalSacramentos: number;
    totalCatequizandos: number;
    totalFamilias: number;
    totalComunidades: number;
    totalGrupos: number;
  }> {
    const db = await getDb();
    const n = async (sql: string) => {
      const r = await db.select<{ n: number }[]>(sql);
      return r[0]?.n ?? 0;
    };
    const [totalFieis, totalDizimistas, totalSacramentos, totalCatequizandos, totalFamilias, totalComunidades, totalGrupos] = await Promise.all([
      n("SELECT COUNT(*) as n FROM fieis WHERE deleted_at IS NULL"),
      n("SELECT COUNT(*) as n FROM fieis WHERE deleted_at IS NULL AND isDizimista=1"),
      n("SELECT COUNT(*) as n FROM sacramentos_registros WHERE deleted_at IS NULL"),
      n("SELECT COUNT(*) as n FROM catequese_matriculas WHERE deleted_at IS NULL AND situacao NOT IN ('CONCLUIDO','CANCELADO')"),
      n("SELECT COUNT(*) as n FROM familias WHERE deleted_at IS NULL"),
      n("SELECT COUNT(*) as n FROM comunidades WHERE deleted_at IS NULL"),
      n("SELECT COUNT(*) as n FROM grupos WHERE deleted_at IS NULL"),
    ]);
    return { totalFieis, totalDizimistas, totalSacramentos, totalCatequizandos, totalFamilias, totalComunidades, totalGrupos };
  },
};
