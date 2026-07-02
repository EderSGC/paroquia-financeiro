import { describe, it, expect } from "vitest";
import { hasPermission, canAccessModule, getPermissions, getAllModulesForPapel } from "./permissions";

describe("hasPermission", () => {
  it("admin tem todas as permissões em todos os módulos", () => {
    expect(hasPermission("admin", "fieis", "criar")).toBe(true);
    expect(hasPermission("admin", "financeiro", "acessar_financeiro")).toBe(true);
    expect(hasPermission("admin", "configuracoes", "restaurar_backup")).toBe(true);
    expect(hasPermission("admin", "configuracoes", "gerenciar_usuarios")).toBe(true);
    expect(hasPermission("admin", "config", "gerenciar_usuarios")).toBe(true);
  });

  it("pároco tem acesso total", () => {
    expect(hasPermission("paroquia", "fieis", "excluir")).toBe(true);
    expect(hasPermission("paroquia", "configuracoes", "restaurar_backup")).toBe(true);
  });

  it("secretária pode criar fiéis mas não restaurar backup", () => {
    expect(hasPermission("secretaria", "fieis", "criar")).toBe(true);
    expect(hasPermission("secretaria", "fieis", "editar")).toBe(true);
    expect(hasPermission("secretaria", "configuracoes", "restaurar_backup")).toBe(false);
    expect(hasPermission("secretaria", "configuracoes", "gerenciar_usuarios")).toBe(false);
  });

  it("tesoureiro só acessa financeiro e patrimônio com CRUD", () => {
    expect(hasPermission("tesoureiro", "financeiro", "criar")).toBe(true);
    expect(hasPermission("tesoureiro", "financeiro", "acessar_financeiro")).toBe(true);
    expect(hasPermission("tesoureiro", "fieis", "criar")).toBe(false);
    expect(hasPermission("tesoureiro", "fieis", "visualizar")).toBe(true);
    expect(hasPermission("tesoureiro", "sacramentos", "visualizar")).toBe(false);
  });

  it("catequista só acessa catequese com CRUD", () => {
    expect(hasPermission("catequista", "catequese", "criar")).toBe(true);
    expect(hasPermission("catequista", "catequese", "emitir_documento")).toBe(true);
    expect(hasPermission("catequista", "financeiro", "visualizar")).toBe(false);
    expect(hasPermission("catequista", "fieis", "criar")).toBe(false);
    expect(hasPermission("catequista", "fieis", "visualizar")).toBe(true);
  });

  it("membro tem apenas visualização", () => {
    expect(hasPermission("membro", "fieis", "visualizar")).toBe(true);
    expect(hasPermission("membro", "fieis", "criar")).toBe(false);
    expect(hasPermission("membro", "financeiro", "visualizar")).toBe(true);
    expect(hasPermission("membro", "financeiro", "criar")).toBe(false);
    expect(hasPermission("membro", "configuracoes", "visualizar")).toBe(false);
  });

  it("retorna false para papel ou módulo inexistente", () => {
    expect(hasPermission("inexistente" as any, "fieis", "visualizar")).toBe(false);
    expect(hasPermission("admin", "modulo_fake" as any, "visualizar")).toBe(false);
  });
});

describe("canAccessModule", () => {
  it("admin acessa todos os módulos", () => {
    expect(canAccessModule("admin", "fieis")).toBe(true);
    expect(canAccessModule("admin", "configuracoes")).toBe(true);
    expect(canAccessModule("admin", "auditoria")).toBe(true);
  });

  it("membro não acessa configurações", () => {
    expect(canAccessModule("membro", "configuracoes")).toBe(false);
    expect(canAccessModule("membro", "config")).toBe(false);
    expect(canAccessModule("membro", "auditoria")).toBe(false);
  });

  it("catequista não acessa financeiro", () => {
    expect(canAccessModule("catequista", "financeiro")).toBe(false);
  });
});

describe("getPermissions", () => {
  it("retorna lista de ações para módulo", () => {
    const perms = getPermissions("secretaria", "fieis");
    expect(perms).toContain("visualizar");
    expect(perms).toContain("criar");
    expect(perms).toContain("editar");
    expect(perms).toContain("excluir");
    expect(perms).toContain("emitir_documento");
  });

  it("retorna array vazio para módulo inacessível", () => {
    expect(getPermissions("catequista", "financeiro")).toEqual([]);
  });
});

describe("getAllModulesForPapel", () => {
  it("admin tem acesso a todos os módulos", () => {
    const mods = getAllModulesForPapel("admin");
    expect(mods.length).toBe(15);
  });

  it("membro tem acesso limitado", () => {
    const mods = getAllModulesForPapel("membro");
    expect(mods).toContain("dashboard");
    expect(mods).toContain("fieis");
    expect(mods).not.toContain("configuracoes");
    expect(mods).not.toContain("auditoria");
  });
});
