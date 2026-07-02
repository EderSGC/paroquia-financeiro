import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { Paroquia } from "@core/types/app.types";

export type ModuleId =
  | "financeiro"
  | "comunidades"
  | "fieis"
  | "dizimistas"
  | "config";

export type SelectedItem =
  | {
      type: "lancamento";
      id: number;
      tipoLanc: "ENTRADA" | "SAIDA";
      valor: number;
      descricao: string;
      data: string;
      categoria?: string;
      origem?: string;
    };

interface WorkspaceCtx {
  activeModule: ModuleId;
  subPage?: string;
  navigate: (mod: ModuleId | string, sub?: string) => void;
  panelOpen: boolean;
  togglePanel: () => void;
  selectedItem: SelectedItem | null;
  selectItem: (item: SelectedItem | null) => void;
  paroquia: Paroquia | null;
}

const Ctx = createContext<WorkspaceCtx>({
  activeModule: "financeiro",
  navigate: () => {},
  panelOpen: true,
  togglePanel: () => {},
  selectedItem: null,
  selectItem: () => {},
  paroquia: null,
});

function loadPanelPref(): boolean {
  try { return localStorage.getItem("ws-panel-open") !== "false"; } catch { return true; }
}

export function WorkspaceProvider({ initialModule = "financeiro", paroquia = null, children }: {
  initialModule?: string;
  paroquia?: Paroquia | null;
  children: ReactNode;
}) {
  const [activeModule, setActiveModule] = useState<ModuleId>(initialModule as ModuleId);
  const [subPage, setSubPage] = useState<string | undefined>();
  const [panelOpen, setPanelOpen] = useState(loadPanelPref);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const navigate = useCallback((mod: ModuleId | string, sub?: string) => {
    setActiveModule(mod as ModuleId);
    setSubPage(sub);
    setSelectedItem(null);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem("ws-panel-open", String(next)); } catch {}
      return next;
    });
  }, []);

  const selectItem = useCallback((item: SelectedItem | null) => {
    setSelectedItem(item);
    if (item) {
      setPanelOpen(prev => {
        if (!prev) try { localStorage.setItem("ws-panel-open", "true"); } catch {}
        return true;
      });
    }
  }, []);

  const value = useMemo(() => ({
    activeModule, subPage, navigate, panelOpen, togglePanel, selectedItem, selectItem, paroquia: paroquia ?? null,
  }), [activeModule, subPage, navigate, panelOpen, togglePanel, selectedItem, selectItem, paroquia]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  return useContext(Ctx);
}
