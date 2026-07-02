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
