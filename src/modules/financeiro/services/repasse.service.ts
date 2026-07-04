import { getDb } from '@core/database';
import type { ConfigPartilha } from '../../auth/services/auth.service';

export interface ResultadoRepasse {
  saldoBase: number;
  comunidade: number;
  areaMissionaria: number;
  arquidiocese: number;
  fundoMissionario: number;
  totalRepasse: number;
  saldoDisponivel: number;
}

export const PARTILHA_PADRAO: ConfigPartilha = {
  comunidade: 30, areaMissionaria: 40, arquidiocese: 29, fundoMissionario: 1,
};

/**
 * Aplica a cascata de repasses em ordem canônica.
 * Cada percentual incide sobre o restante após a dedução anterior:
 *   1. Comunidade        → sobre o saldo base
 *   2. Área Missionária  → sobre o restante após comunidade
 *   3. Arquidiocese      → sobre o restante após área missionária
 *   4. Fundo Missionário → sobre o restante após arquidiocese
 */
export function calcularRepasse(saldoBase: number, cfg: ConfigPartilha): ResultadoRepasse {
  const base = Math.max(0, saldoBase);
  if (base === 0) {
    return {
      saldoBase: 0, comunidade: 0, areaMissionaria: 0,
      arquidiocese: 0, fundoMissionario: 0, totalRepasse: 0, saldoDisponivel: 0,
    };
  }
  const comunidade       = base * (cfg.comunidade / 100);
  const r1               = base - comunidade;
  const areaMissionaria  = r1 * (cfg.areaMissionaria / 100);
  const r2               = r1 - areaMissionaria;
  const arquidiocese     = r2 * (cfg.arquidiocese / 100);
  const r3               = r2 - arquidiocese;
  const fundoMissionario = r3 * (cfg.fundoMissionario / 100);
  const saldoDisponivel  = r3 - fundoMissionario;
  return {
    saldoBase: base,
    comunidade,
    areaMissionaria,
    arquidiocese,
    fundoMissionario,
    totalRepasse: comunidade + areaMissionaria + arquidiocese + fundoMissionario,
    saldoDisponivel,
  };
}

/** Converte uma linha do banco (snake_case) para ConfigPartilha (camelCase). */
export function dbRowToPartilha(row: Record<string, unknown>): ConfigPartilha {
  const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
  return {
    comunidade:       n(row.comunidade),
    areaMissionaria:  n(row.area_missionaria),
    arquidiocese:     n(row.arquidiocese),
    fundoMissionario: n(row.fundo_missionario),
  };
}

export interface SaldoAnteriorResolvido {
  valor: number;
  /**
   * De onde o valor veio:
   *  - 'historico': conciliado a partir de meses anteriores — a tela bloqueia a edição
   *  - 'mes_atual': digitado pelo usuário no próprio mês — permanece editável,
   *    para que o procedimento de correção (zerar e salvar) funcione
   *  - 'nenhum': sem dado — campo livre
   */
  origem: 'historico' | 'mes_atual' | 'nenhum';
}

/**
 * Resolve o Saldo Anterior Conciliado de um mês/unidade.
 *
 * Fonte única usada pela tela de Conferência Física E pelos relatórios
 * impressos — os dois precisam exibir sempre o mesmo valor.
 *
 * Ordem de busca:
 *   1. Último saldo_disponivel > 0 gravado em qualquer mês anterior
 *   2. Saldo Final Disponível reconstruído do mês imediatamente anterior
 *   3. Último saldo_anterior > 0 gravado em qualquer mês anterior
 *   4. saldo_anterior > 0 digitado no próprio mês (primeiro fechamento do mês)
 */
export async function resolverSaldoAnteriorConciliado(mes: string, unidade: string): Promise<SaldoAnteriorResolvido> {
  const db = await getDb();

  const cfgRows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1"
  );
  const cfg = cfgRows[0] ?? { comunidade: 30, area_missionaria: 40, arquidiocese: 29, fundo_missionario: 1 };

  // Calcula o Saldo Final Disponível de um mês a partir dos dados do banco
  const calcSaldoFinalMes = async (m: string): Promise<number> => {
    const primFechs = await db.select<{ saldo_anterior: number | null }[]>(
      "SELECT saldo_anterior FROM caixa_fechamento WHERE data LIKE $1 AND unidade = $2 AND saldo_anterior > 0 ORDER BY data ASC LIMIT 1",
      [`${m}%`, unidade]
    );
    const saldoInicio = Number(primFechs[0]?.saldo_anterior ?? 0);

    const lancs = await db.select<{ tipo: string; valor: number }[]>(
      "SELECT tipo, valor FROM lancamentos WHERE data LIKE $1 AND origem = $2 AND deleted_at IS NULL",
      [`${m}%`, unidade]
    );
    const ent = lancs.filter(r => r.tipo === 'ENTRADA').reduce((s, r) => s + r.valor, 0);
    const sai = lancs.filter(r => r.tipo === 'SAIDA').reduce((s, r) => s + r.valor, 0);
    const base = Math.max(0, ent - sai);

    const { saldoDisponivel } = calcularRepasse(base, dbRowToPartilha(cfg));
    return saldoInicio + saldoDisponivel;
  };

  const primeiroDiaMes = `${mes}-01`;

  // ── Passo 1: Melhor dado de qualquer mês anterior com saldo_disponivel salvo ──
  const fechDisp = await db.select<{ saldo_disponivel: number | null }[]>(
    "SELECT saldo_disponivel FROM caixa_fechamento WHERE data < $1 AND unidade = $2 AND saldo_disponivel > 0 ORDER BY data DESC LIMIT 1",
    [primeiroDiaMes, unidade]
  );
  if (fechDisp.length > 0) {
    return { valor: Number(fechDisp[0].saldo_disponivel), origem: 'historico' };
  }

  // ── Passo 2: Reconstrói o Saldo Final Disponível do mês imediatamente anterior ──
  const [anoSel, mesSelNum] = mes.split('-').map(Number);
  const mesAntNum = mesSelNum === 1 ? 12 : mesSelNum - 1;
  const anoAnt    = mesSelNum === 1 ? anoSel - 1 : anoSel;
  const mesAnt    = `${anoAnt}-${String(mesAntNum).padStart(2, '0')}`;

  const saldoFinalMesAnt = await calcSaldoFinalMes(mesAnt);
  if (saldoFinalMesAnt > 0) {
    return { valor: saldoFinalMesAnt, origem: 'historico' };
  }

  // ── Passo 3: Qualquer saldo_anterior > 0 de qualquer mês anterior (último dado histórico) ──
  const fechQualquer = await db.select<{ saldo_anterior: number | null }[]>(
    "SELECT saldo_anterior FROM caixa_fechamento WHERE data < $1 AND unidade = $2 AND saldo_anterior > 0 ORDER BY data DESC LIMIT 1",
    [primeiroDiaMes, unidade]
  );
  if (fechQualquer.length > 0) {
    return { valor: Number(fechQualquer[0].saldo_anterior), origem: 'historico' };
  }

  // ── Passo 4: saldo_anterior do mês atual (valor que o usuário digitou ao abrir este mês) ──
  const fechMesAtual = await db.select<{ saldo_anterior: number | null }[]>(
    "SELECT saldo_anterior FROM caixa_fechamento WHERE data LIKE $1 AND unidade = $2 AND saldo_anterior > 0 ORDER BY data ASC LIMIT 1",
    [`${mes}%`, unidade]
  );
  if (fechMesAtual.length > 0) {
    return { valor: Number(fechMesAtual[0].saldo_anterior), origem: 'mes_atual' };
  }

  return { valor: 0, origem: 'nenhum' };
}
