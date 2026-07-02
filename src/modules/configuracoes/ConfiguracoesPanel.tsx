import { useEffect, useState } from "react";
import { getDb } from "@core/database";
import { PanelSection, PanelDivider, PanelRow } from "@/components/ui/SectionHeader";

interface Stats {
  totalUsuarios: number;
  totalAuditoria: number;
  ultimaAuditoria: string | null;
  ultimoBackup: string | null;
  migrationsAplicadas: number;
}

const empty: Stats = { totalUsuarios: 0, totalAuditoria: 0, ultimaAuditoria: null, ultimoBackup: null, migrationsAplicadas: 0 };

export function ConfiguracoesPanel() {
  const [data, setData] = useState<Stats>(empty);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const n = async (sql: string) => {
          const r = await db.select<{ n: number }[]>(sql);
          return r[0]?.n ?? 0;
        };

        const [totalUsuarios, totalAuditoria, migrationsAplicadas] = await Promise.all([
          n("SELECT COUNT(*) as n FROM usuarios WHERE deleted_at IS NULL"),
          n("SELECT COUNT(*) as n FROM auditoria"),
          n("SELECT COUNT(*) as n FROM schema_migrations"),
        ]);

        const ultimaRows = await db.select<{ data_hora: string }[]>(
          "SELECT data_hora FROM auditoria ORDER BY id DESC LIMIT 1"
        ).catch(() => []);

        if (cancelled) return;
        setData({
          totalUsuarios,
          totalAuditoria,
          ultimaAuditoria: ultimaRows[0]?.data_hora ?? null,
          ultimoBackup: null,
          migrationsAplicadas,
        });
      } catch (e) {
        console.error("ConfiguracoesPanel:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return s; }
  };

  return (
    <>
      <PanelSection title="Sistema">
        <PanelRow label="Versão" value="1.1.0" />
        <PanelRow label="Migrations aplicadas" value={data.migrationsAplicadas} />
      </PanelSection>

      <PanelDivider />

      <PanelSection title="Usuários">
        <PanelRow label="Ativos" value={data.totalUsuarios} />
      </PanelSection>

      <PanelDivider />

      <PanelSection title="Auditoria">
        <PanelRow label="Total de registros" value={data.totalAuditoria.toLocaleString("pt-BR")} />
        {data.ultimaAuditoria && (
          <PanelRow label="Último registro" value={fmtDate(data.ultimaAuditoria)} />
        )}
      </PanelSection>
    </>
  );
}
