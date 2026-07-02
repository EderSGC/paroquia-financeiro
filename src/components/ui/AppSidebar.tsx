import {
  DollarSign, Building2, User, HeartHandshake, Settings, LogOut, Sun, Moon,
  type LucideIcon,
} from "lucide-react";
import { AppLogo } from "@core/ui/AppLogo";
import type { Paroquia, Usuario } from "@core/types/app.types";
import { LABEL_PAPEL } from "@core/types/app.types";
import { canAccessModule, hasPermission } from "@core/auth/permissions";
import { useWorkspace, type ModuleId } from "@/layouts/WorkspaceContext";

interface NavItem {
  id: ModuleId | "__logout";
  label: string;
  icon: LucideIcon;
  group: string;
  sub?: string;
  isAction?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  // GESTÃO
  { id: "financeiro",  label: "Financeiro",    group: "Gestão",    icon: DollarSign },
  // CADASTROS
  { id: "comunidades", label: "Comunidades",   group: "Cadastros", icon: Building2 },
  { id: "fieis",       label: "Fiéis",         group: "Cadastros", icon: User },
  { id: "dizimistas",  label: "Dizimistas",    group: "Cadastros", icon: HeartHandshake },
  // SISTEMA
  { id: "config",      label: "Configurações", group: "Sistema",   icon: Settings },
  { id: "__logout",    label: "Sair",          group: "Sistema",   icon: LogOut, isAction: true },
];

const GROUPS = ["Gestão", "Cadastros", "Sistema"] as const;

// "dizimistas" não existe na matriz de permissões — usa as permissões de "fieis"
function permissionId(id: string): string {
  return id === "dizimistas" ? "fieis" : id;
}

interface Props {
  paroquia: Paroquia;
  usuario: Usuario;
  isDark: boolean;
  onLogout: () => void;
  onToggleTheme: () => void;
}

export function AppSidebar({ paroquia, usuario, isDark, onLogout, onToggleTheme }: Props) {
  const { activeModule, navigate } = useWorkspace();
  const isAdmin = hasPermission(usuario.papel, "configuracoes", "gerenciar_usuarios");

  function canView(item: NavItem): boolean {
    if (item.isAction) return true;
    return canAccessModule(usuario.papel, permissionId(item.id));
  }

  function handleClick(item: NavItem) {
    if (item.id === "__logout") { onLogout(); return; }
    if (!canAccessModule(usuario.papel, permissionId(item.id))) return;
    navigate(item.id, item.sub);
  }

  function isActive(item: NavItem): boolean {
    if (item.isAction) return false;
    return activeModule === item.id;
  }

  return (
    <aside className="sidebar-root" style={{ display: "flex", flexDirection: "column" }}>
      {/* Titlebar / traffic lights */}
      <div className="draggable-region sidebar-header">
        <div className="no-drag sidebar-brand">
          <AppLogo
            logoPath={paroquia.logo_path}
            alt="Logo"
            size={26}
            radius={7}
            fallbackText={paroquia.nome?.[0] ?? "P"}
            background="#FFFFFF"
            padding={2}
          />
          <span className="sidebar-brand-name" style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {paroquia.nome}
          </span>
        </div>
      </div>

      {/* User badge */}
      <div className="no-drag sidebar-user">
        <div className="sidebar-avatar" style={{ background: isAdmin ? "#007AFF" : "#34C759" }}>
          {usuario.nome[0]?.toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{usuario.nome}</div>
          <div className="sidebar-user-role">{LABEL_PAPEL[usuario.papel] ?? usuario.papel}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav mac-scrollbar no-drag" style={{ flex: 1, overflowY: "auto" }}>
        {GROUPS.map((grupo) => {
          const itens = NAV_ITEMS.filter(i => i.group === grupo && canView(i));
          if (itens.length === 0) return null;
          return (
            <div key={grupo} className="sidebar-group">
              <div className="sidebar-group-label">{grupo}</div>
              {itens.map(item => {
                const Icon = item.icon;
                const ativo = isActive(item);
                return (
                  <button
                    key={item.id}
                    className={[
                      "sidebar-item",
                      ativo ? "sidebar-item--active" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleClick(item)}
                    style={item.id === "__logout" ? { color: "var(--accent-red)", marginTop: 4 } : undefined}
                  >
                    <Icon size={14} className="sidebar-item-icon" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="no-drag sidebar-footer">
        <button className="sidebar-item" onClick={onToggleTheme}>
          {isDark ? <Sun size={14} className="sidebar-item-icon" /> : <Moon size={14} className="sidebar-item-icon" />}
          {isDark ? "Modo Claro" : "Modo Escuro"}
        </button>
      </div>
    </aside>
  );
}
