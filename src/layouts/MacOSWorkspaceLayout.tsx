import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "@core/hooks/useTheme";
import { useToast } from "@core/ui/Toast";
import { fazerBackup, restaurarBackup } from "@core/services/backup.service";

import type { Paroquia, Usuario, PapelUsuario } from "@core/types/app.types";
import { canAccessModule } from "@core/auth/permissions";

import { WorkspaceProvider, useWorkspace, type ModuleId } from "./WorkspaceContext";
import { ItemDetailPanel } from "@/components/ui/ItemDetailPanel";
import { AppSidebar } from "@/components/ui/AppSidebar";
import { ContextPanel } from "@/components/ui/ContextPanel";

import { FinanceiroPanel } from "@/modules/financeiro/FinanceiroPanel";
import { ConfiguracoesPanel } from "@/modules/configuracoes/ConfiguracoesPanel";
import { FinanceiroPage } from "@/modules/financeiro";
import { CadastrosPage, type AbaCadastro } from "@/modules/cadastros/pages/CadastrosPage";
import { SystemConfigPage } from "@/modules/shell/pages/SystemConfigPage";
import { SobrePage } from "@/modules/shell/pages/SobrePage";

interface Props {
  paroquia: Paroquia;
  usuario: Usuario;
  onParoquiaUpdate: (p: Paroquia) => void;
  onLogout: () => void;
}

const CADASTRO_ABAS: Record<string, AbaCadastro> = {
  comunidades: "comunidades",
  fieis:       "fieis",
  dizimistas:  "dizimistas",
};

function canAccess(papel: string, mod: string): boolean {
  // "dizimistas" não existe na matriz de permissões — usa as permissões de "fieis"
  const base = mod === "dizimistas" ? "fieis" : mod;
  return canAccessModule(papel as PapelUsuario, base);
}

/* ─── Inner layout (needs WorkspaceContext) ────────────────────────────── */
function WorkspaceShell({ paroquia, usuario, onParoquiaUpdate, onLogout }: Props) {
  const { activeModule, subPage, navigate, selectedItem } = useWorkspace();
  const { isDark, setTheme } = useTheme();
  const { showToast } = useToast();

  // Native macOS menu events
  useEffect(() => {
    const unNav  = listen<string>("navegar", e => {
      const [mod, sub] = e.payload.split(":");
      navigate(mod as ModuleId, sub);
    });
    const unSobre    = listen("menu_sobre",    () => navigate("__sobre" as ModuleId));
    const unBackup   = listen("menu_backup",   () => {
      fazerBackup()
        .then(p => showToast(`Backup salvo: ${p}`, "success"))
        .catch(e => { if (e?.message !== "CANCELLED") showToast("Erro ao fazer backup.", "error"); });
    });
    const unRestaura = listen("menu_restaurar", async () => {
      if (!confirm("Substituir todos os dados atuais pelo backup? Esta ação não pode ser desfeita.")) return;
      try { await restaurarBackup(); showToast("Backup restaurado.", "success"); }
      catch (e) { if ((e as Error)?.message !== "CANCELLED") showToast("Erro ao restaurar.", "error"); }
    });
    return () => {
      unNav.then(fn => fn());
      unSobre.then(fn => fn());
      unBackup.then(fn => fn());
      unRestaura.then(fn => fn());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Render workspace content ────────────────────────────────────── */
  function renderWorkspace() {
    const mod = activeModule as string;

    if (!canAccess(usuario.papel, mod)) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-secondary)" }}>
          <div style={{ fontSize: 36 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Acesso restrito</div>
          <div style={{ fontSize: 13 }}>Você não tem permissão para este módulo.</div>
        </div>
      );
    }

    if (mod === "config")     return <SystemConfigPage paroquia={paroquia} usuario={usuario} onParoquiaUpdated={onParoquiaUpdate} />;
    if (mod === "financeiro") return <FinanceiroPage paroquia={paroquia} usuario={usuario} abaPadrao={subPage} />;
    if (CADASTRO_ABAS[mod])   return <CadastrosPage key={mod} aba={CADASTRO_ABAS[mod]} />;

    return null;
  }

  /* ── Render context panel content ────────────────────────────────── */
  function renderPanelTitle(): string {
    if (selectedItem) {
      if (selectedItem.type === "lancamento") return selectedItem.tipoLanc === "ENTRADA" ? "Receita" : "Despesa";
    }
    const titles: Record<string, string> = {
      financeiro:  "Financeiro",
      comunidades: "Cadastros",
      fieis:       "Cadastros",
      dizimistas:  "Cadastros",
      config:      "Configurações",
    };
    return titles[activeModule] ?? "Visão Geral";
  }

  function renderPanel() {
    const mod = activeModule as string;
    if (selectedItem) return <ItemDetailPanel />;
    if (mod === "financeiro") return <FinanceiroPanel />;
    if (mod === "config")     return <ConfiguracoesPanel />;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, padding: "24px 0" }}>
        <div style={{ fontSize: 28, opacity: 0.25 }}>⬚</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>
          Selecione um item<br />para ver detalhes
        </div>
      </div>
    );
  }

  return (
    <>
      {activeModule === ("__sobre" as ModuleId) && (
        <SobrePage onFechar={() => navigate("financeiro")} />
      )}

      <div
        className="app-workspace"
        style={{
          display: "flex",
          width: "100%",
          height: "100vh",
          overflow: "hidden",
          fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
          color: "var(--text-primary)",
        }}
      >
        {/* Column 1 — Sidebar (190px, fixed) */}
        <AppSidebar
          paroquia={paroquia}
          usuario={usuario}
          isDark={isDark}
          onLogout={onLogout}
          onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
        />

        {/* Column 2 — Workspace (flex-basis:0 + flex-grow:1, sempre ocupa o espaço restante) */}
        <div
          className="workspace-main mac-scrollbar"
          data-surface="workspace"
          style={{
            flex: "1 1 0px",
            display: "flex",
            flexDirection: "column",
            width: 0,
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            position: "relative",
            zIndex: 1,
            margin: "8px 6px 0 6px",
            borderRadius: "14px 14px 0 0",
            background: isDark
              ? "rgba(10, 22, 54, 0.96)"
              : "linear-gradient(180deg, rgba(248,250,252,0.96), rgba(242,246,251,0.96))",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
          }}
        >
          {renderWorkspace()}
        </div>

        {/* Column 3 — Context Panel (320px, collapsible) */}
        <ContextPanel title={renderPanelTitle()}>
          {renderPanel()}
        </ContextPanel>
      </div>
    </>
  );
}

/* ─── Public entry — wraps with WorkspaceProvider ──────────────────────── */
export function MacOSWorkspaceLayout({ paroquia, usuario, onParoquiaUpdate, onLogout }: Props) {
  return (
    <WorkspaceProvider initialModule="financeiro" paroquia={paroquia}>
      <WorkspaceShell
        paroquia={paroquia}
        usuario={usuario}
        onParoquiaUpdate={onParoquiaUpdate}
        onLogout={onLogout}
      />
    </WorkspaceProvider>
  );
}
