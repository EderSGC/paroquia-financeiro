import { getDb } from '@core/database';
import { Lancamento, CaixaFechamento, ConfiguracaoPartilha } from '@core/types/entities';
import { BaseRepository } from '@core/repository';

interface LancamentoComFiel extends Lancamento {
  nome_fiel?: string | null;
}

class LancamentoRepositoryClass extends BaseRepository<Lancamento> {
  constructor() {
    super('lancamentos', true);
  }

  async findRecentes(cutoff: string): Promise<LancamentoComFiel[]> {
    const db = await getDb();
    return db.select<LancamentoComFiel[]>(`
      SELECT l.*, f.nome AS nome_fiel
      FROM lancamentos l
      LEFT JOIN fieis f ON l.fiel_id = f.id
      WHERE l.data >= ? AND l.deleted_at IS NULL
      ORDER BY l.data DESC
    `, [cutoff]);
  }

  async findEntradas(limit = 100): Promise<Lancamento[]> {
    const db = await getDb();
    return db.select<Lancamento[]>(
      'SELECT id, descricao, valor, data, categoria, origem FROM lancamentos WHERE tipo=\'ENTRADA\' AND deleted_at IS NULL ORDER BY data DESC, id DESC LIMIT ?',
      [limit]
    );
  }

  async findSaidas(limit = 100): Promise<Lancamento[]> {
    const db = await getDb();
    return db.select<Lancamento[]>(
      'SELECT id, descricao, valor, data, categoria, origem FROM lancamentos WHERE tipo=\'SAIDA\' AND deleted_at IS NULL ORDER BY data DESC, id DESC LIMIT ?',
      [limit]
    );
  }

  async findByPeriodo(
    inicio: string, fim: string,
    filtroUnidade?: string, filtroTipo?: string
  ): Promise<Lancamento[]> {
    const db = await getDb();
    let sql = "SELECT id, descricao, valor, tipo, data, COALESCE(categoria,'') as categoria, COALESCE(origem,'PAROQUIA') as origem FROM lancamentos WHERE data BETWEEN ? AND ? AND deleted_at IS NULL";
    const params: unknown[] = [inicio, fim];
    if (filtroUnidade && filtroUnidade !== 'TODOS') { sql += ' AND origem=?'; params.push(filtroUnidade); }
    if (filtroTipo && filtroTipo !== 'TODOS') { sql += ' AND tipo=?'; params.push(filtroTipo); }
    sql += ' ORDER BY data DESC, id DESC';
    return db.select<Lancamento[]>(sql, params);
  }

  async sumGlobal(): Promise<{ entradas: number; saidas: number }> {
    const db = await getDb();
    const res = await db.select<{ entradas: number; saidas: number }[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
        COALESCE(SUM(CASE WHEN tipo='SAIDA'   THEN valor ELSE 0 END), 0) AS saidas
      FROM lancamentos WHERE deleted_at IS NULL
    `);
    return res[0] ?? { entradas: 0, saidas: 0 };
  }
}

class CaixaFechamentoRepositoryClass extends BaseRepository<CaixaFechamento> {
  constructor() {
    super('caixa_fechamento', false);
  }

  async findByDataUnidade(data_: string, unidade: string): Promise<CaixaFechamento | null> {
    const db = await getDb();
    const rows = await db.select<CaixaFechamento[]>(
      'SELECT * FROM caixa_fechamento WHERE data = $1 AND unidade = $2 LIMIT 1',
      [data_, unidade]
    );
    return rows[0] ?? null;
  }

  async upsert(
    data_: string, unidade: string,
    dinheiro: number, pix: number, saldoAnterior: number,
    observacao: string, saldoDisponivel: number
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO caixa_fechamento (data, unidade, dinheiro, pix, saldo_anterior, observacao, saldo_disponivel)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(data, unidade) DO UPDATE SET dinheiro=$3, pix=$4, saldo_anterior=$5, observacao=$6, saldo_disponivel=$7`,
      [data_, unidade, dinheiro, pix, saldoAnterior, observacao, saldoDisponivel]
    );
  }
}

class ConfiguracaoRepositoryClass extends BaseRepository<ConfiguracaoPartilha> {
  constructor() {
    super('configuracoes_partilha', false);
  }

  async findConfig(): Promise<ConfiguracaoPartilha | null> {
    const db = await getDb();
    const rows = await db.select<ConfiguracaoPartilha[]>(
      'SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1'
    ).catch(() => [] as ConfiguracaoPartilha[]);
    return rows[0] ?? null;
  }
}

async function findComunidades(): Promise<{ id: number; nome: string }[]> {
  const db = await getDb();
  return db.select<{ id: number; nome: string }[]>('SELECT id, nome FROM comunidades WHERE deleted_at IS NULL ORDER BY nome ASC');
}

export const FinanceiroRepository = {
  lancamentos: new LancamentoRepositoryClass(),
  caixas: new CaixaFechamentoRepositoryClass(),
  config: new ConfiguracaoRepositoryClass(),
  findComunidades,
};
