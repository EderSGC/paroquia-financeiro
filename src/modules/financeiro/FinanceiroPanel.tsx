import { useEffect, useState } from "react";
import { getDb } from "@core/database";
import { calcularRepasse, dbRowToPartilha } from "./services/repasse.service";
import { PanelSection, PanelDivider, PanelRow } from "@/components/ui/SectionHeader";
import { hasPermission } from "@core/auth/permissions";
import type { Usuario } from "@core/types/app.types";

interface UnitData {
  unidade: string;
  saldoFinal: number;
}

interface Stats {
  saldoFinalDisponivel: number;
  receitaMes: number;
  despesaMes: number;
  totalRepasse: number;
  saldoRealMes: number;
  lancamentosMes: number;
  receitaAno: number;
  despesaAno: number;
  unitSaldos: UnitData[];
}

const empty: Stats = {
  saldoFinalDisponivel: 0,
  receitaMes: 0, despesaMes: 0, totalRepasse: 0, saldoRealMes: 0, lancamentosMes: 0,
  receitaAno: 0, despesaAno: 0, unitSaldos: [],
};

// Retorna sempre um número válido, nunca NaN
function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}


export function FinanceiroPanel({ usuario }: { usuario?: Usuario }) {
  const [data, setData] = useState<Stats>(empty);

  // Mesma regra da FinanceiroPage: quem não acessa configurações do financeiro
  // (membro de comunidade) só enxerga os números da própria comunidade.
  const isMembro = usuario ? !hasPermission(usuario.papel, "financeiro", "acessar_configuracoes") : false;
  const comunidadeFiltro = isMembro ? (usuario?.comunidade_nome ?? null) : null;

  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      try {
        const db = await getDb();
        const hoje = new Date();
        const anoMes = hoje.toISOString().slice(0, 7);
        const ano = String(hoje.getFullYear());
        const comSql = comunidadeFiltro ? " AND origem = ?" : "";
        const comParam = comunidadeFiltro ? [comunidadeFiltro] : [];

        // Helper: executa query e devolve o primeiro valor como número
        const num = async (sql: string, p: unknown[] = []): Promise<number> => {
          const rows = await db.select<Record<string, unknown>[]>(sql, p);
          const val = rows[0] ? Object.values(rows[0])[0] : 0;
          return toNum(val);
        };

        // Configuração de repasse (defaults se tabela não existir)
        const cfgRows = await db
          .select<Record<string, unknown>[]>("SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1")
          .catch(() => [] as Record<string, unknown>[]);
        const cfg: Record<string, unknown> = cfgRows[0] ?? {
          comunidade: 30, area_missionaria: 40, arquidiocese: 29, fundo_missionario: 1,
        };

        // Métricas mensais (bruto, do lançamentos)
        const [receitaMes, despesaMes, receitaAno, despesaAno, lancamentosMes] = await Promise.all([
          num(`SELECT COALESCE(SUM(valor),0) FROM lancamentos WHERE tipo='ENTRADA' AND substr(data,1,7)=? AND deleted_at IS NULL${comSql}`, [anoMes, ...comParam]),
          num(`SELECT COALESCE(SUM(valor),0) FROM lancamentos WHERE tipo='SAIDA'   AND substr(data,1,7)=? AND deleted_at IS NULL${comSql}`, [anoMes, ...comParam]),
          num(`SELECT COALESCE(SUM(valor),0) FROM lancamentos WHERE tipo='ENTRADA' AND substr(data,1,4)=? AND deleted_at IS NULL${comSql}`, [ano, ...comParam]),
          num(`SELECT COALESCE(SUM(valor),0) FROM lancamentos WHERE tipo='SAIDA'   AND substr(data,1,4)=? AND deleted_at IS NULL${comSql}`, [ano, ...comParam]),
          num(`SELECT COUNT(*) FROM lancamentos WHERE substr(data,1,7)=? AND deleted_at IS NULL${comSql}`, [anoMes, ...comParam]),
        ]);

        const { totalRepasse, saldoDisponivel: saldoRealMes } = calcularRepasse(receitaMes - despesaMes, dbRowToPartilha(cfg));

        // Saldo em tempo real por comunidade
        // Lógica: último fechamento salvo + movimentos PÓS-fechamento com repasse aplicado
        const unitsResult = await db
          .select<{ origem: string }[]>(
            `SELECT DISTINCT origem FROM lancamentos WHERE origem IS NOT NULL AND origem != '' AND deleted_at IS NULL${comSql} ORDER BY origem`,
            comParam
          )
          .catch(() => [] as { origem: string }[]);

        const unitSaldos: UnitData[] = [];

        for (const { origem: unit } of unitsResult) {
          if (!unit) continue;

          // Último fechamento desta unidade (pode não existir)
          const closingRows = await db
            .select<Record<string, unknown>[]>(
              "SELECT COALESCE(saldo_disponivel,0) as sd, data FROM caixa_fechamento WHERE unidade=? ORDER BY data DESC LIMIT 1",
              [unit]
            )
            .catch(() => [] as Record<string, unknown>[]);

          const lastClose = closingRows[0];
          const saldoAnterior = toNum(lastClose?.sd);
          const lastDate = String(lastClose?.data ?? "1900-01-01");

          // Movimentos após o último fechamento (entrada e saída)
          const movRows = await db
            .select<Record<string, unknown>[]>(
              `SELECT
                COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END),0) as ent,
                COALESCE(SUM(CASE WHEN tipo='SAIDA'   THEN valor ELSE 0 END),0) as sai
               FROM lancamentos WHERE origem=? AND data > ? AND deleted_at IS NULL`,
              [unit, lastDate]
            )
            .catch(() => [] as Record<string, unknown>[]);

          const mov = movRows[0] ?? {};
          const saldoMov = toNum(mov.ent) - toNum(mov.sai);
          const saldoRealUnit = calcularRepasse(saldoMov, dbRowToPartilha(cfg)).saldoDisponivel;

          unitSaldos.push({ unidade: unit, saldoFinal: saldoAnterior + saldoRealUnit });
        }

        const saldoFinalDisponivel = unitSaldos.reduce((s, u) => s + u.saldoFinal, 0);

        if (cancelled) return;
        setData({
          saldoFinalDisponivel, receitaMes, despesaMes,
          totalRepasse, saldoRealMes, lancamentosMes,
          receitaAno, despesaAno, unitSaldos,
        });
      } catch (e) {
        console.error("FinanceiroPanel:", e);
      }
    };
    carregar();
    // Recarrega quando qualquer mutação do módulo financeiro dispara o evento
    const onRefresh = () => { carregar(); };
    window.addEventListener('financeiro:refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('financeiro:refresh', onRefresh);
    };
  }, [comunidadeFiltro]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const hoje = new Date();
  const mesCapit = hoje.toLocaleDateString("pt-BR", { month: "long" })
    .replace(/^\w/, c => c.toUpperCase());
  const saldoOk = data.saldoFinalDisponivel >= 0;

  return (
    <>
      <PanelSection title="Saldo Final Disponível">
        <div style={{
          borderRadius: 10,
          background: saldoOk ? "rgba(52,199,89,0.09)" : "rgba(255,59,48,0.09)",
          border: `1px solid ${saldoOk ? "rgba(52,199,89,0.18)" : "rgba(255,59,48,0.18)"}`,
          padding: "10px 12px",
        }}>
          <div style={{
            fontSize: 22, fontWeight: 800, lineHeight: 1,
            color: saldoOk ? "var(--accent-green)" : "var(--accent-red)",
          }}>
            {fmt(data.saldoFinalDisponivel)}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
            Após repasses · tempo real
          </div>
        </div>
      </PanelSection>

      <PanelDivider />

      <PanelSection title={mesCapit}>
        <PanelRow label="Receitas" value={fmt(data.receitaMes)} valueColor="var(--accent-green)" />
        <PanelRow label="Despesas" value={fmt(data.despesaMes)} valueColor="var(--accent-red)" />
        <PanelRow label="Total Repasse" value={fmt(data.totalRepasse)} valueColor="var(--text-secondary)" />
        <PanelRow
          label="Saldo Real"
          value={fmt(data.saldoRealMes)}
          valueColor={data.saldoRealMes >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
        />
        <PanelRow label="Lançamentos" value={data.lancamentosMes} />
      </PanelSection>

      <PanelDivider />

      <PanelSection title={`Ano ${hoje.getFullYear()}`}>
        <PanelRow label="Receitas" value={fmt(data.receitaAno)} valueColor="var(--accent-green)" />
        <PanelRow label="Despesas" value={fmt(data.despesaAno)} valueColor="var(--accent-red)" />
        <PanelRow
          label="Resultado Bruto"
          value={fmt(data.receitaAno - data.despesaAno)}
          valueColor={(data.receitaAno - data.despesaAno) >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
        />
      </PanelSection>

      {data.unitSaldos.length > 0 && (
        <>
          <PanelDivider />
          <PanelSection title="Saldo Real por Comunidade">
            {data.unitSaldos.map(u => (
              <PanelRow
                key={u.unidade}
                label={u.unidade}
                value={fmt(u.saldoFinal)}
                valueColor={u.saldoFinal >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
              />
            ))}
          </PanelSection>
        </>
      )}
    </>
  );
}
