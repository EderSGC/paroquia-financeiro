import { describe, it, expect } from "vitest";
import {
  isValidCPF,
  normalizeText,
  sanitizarTexto,
  sanitizarLogin,
  formatarCNPJ,
  formatarCEP,
  validarParoquia,
  validarUsuario,
} from "./validators";

describe("isValidCPF", () => {
  it("aceita CPF vazio (campo opcional)", () => {
    expect(isValidCPF("")).toBe(true);
  });

  it("rejeita CPF com dígitos repetidos", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("000.000.000-00")).toBe(false);
  });

  it("valida CPF correto", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224725")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(isValidCPF("529.982.247-26")).toBe(false);
  });

  it("rejeita CPF com tamanho incorreto", () => {
    expect(isValidCPF("123")).toBe(false);
    expect(isValidCPF("123456789012")).toBe(false);
  });
});

describe("normalizeText", () => {
  it("remove acentos e normaliza", () => {
    expect(normalizeText("  João  da  Silva  ")).toBe("joao da silva");
  });

  it("retorna vazio para string vazia", () => {
    expect(normalizeText("")).toBe("");
  });

  it("colapsa espaços múltiplos", () => {
    expect(normalizeText("a   b   c")).toBe("a b c");
  });
});

describe("sanitizarTexto", () => {
  it("remove tags HTML", () => {
    expect(sanitizarTexto("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
  });

  it("limita a 255 caracteres", () => {
    const longo = "a".repeat(300);
    expect(sanitizarTexto(longo).length).toBe(255);
  });

  it("faz trim", () => {
    expect(sanitizarTexto("  teste  ")).toBe("teste");
  });
});

describe("sanitizarLogin", () => {
  it("converte para lowercase e remove caracteres inválidos", () => {
    expect(sanitizarLogin("Padre.Eder!@#")).toBe("padre.eder");
  });

  it("limita a 50 caracteres", () => {
    const longo = "a".repeat(60);
    expect(sanitizarLogin(longo).length).toBe(50);
  });
});

describe("formatarCNPJ", () => {
  it("formata CNPJ de 14 dígitos", () => {
    expect(formatarCNPJ("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("retorna original se não tem 14 dígitos", () => {
    expect(formatarCNPJ("123")).toBe("123");
  });
});

describe("formatarCEP", () => {
  it("formata CEP de 8 dígitos", () => {
    expect(formatarCEP("69050001")).toBe("69050-001");
  });

  it("retorna original se não tem 8 dígitos", () => {
    expect(formatarCEP("690")).toBe("690");
  });
});

describe("validarParoquia", () => {
  it("rejeita paróquia sem nome", () => {
    const result = validarParoquia({ nome: "" });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain("Nome da paróquia é obrigatório");
  });

  it("aceita paróquia com nome válido", () => {
    const result = validarParoquia({ nome: "Paróquia São José" });
    expect(result.valido).toBe(true);
  });

  it("gera aviso para email ausente", () => {
    const result = validarParoquia({ nome: "Teste" });
    expect(result.avisos).toContain("Email não informado");
  });

  it("rejeita email inválido", () => {
    const result = validarParoquia({ nome: "Teste", email: "invalido" });
    expect(result.erros).toContain("Email inválido");
  });
});

describe("validarUsuario", () => {
  it("rejeita usuário sem campos obrigatórios", () => {
    const result = validarUsuario({});
    expect(result.valido).toBe(false);
    expect(result.erros.length).toBeGreaterThanOrEqual(3);
  });

  it("rejeita login com caracteres especiais", () => {
    const result = validarUsuario({ nome: "Teste User", login: "user@admin", senha: "123456" });
    expect(result.valido).toBe(false);
  });

  it("rejeita senha curta", () => {
    const result = validarUsuario({ nome: "Teste", login: "teste", senha: "123" });
    expect(result.valido).toBe(false);
    expect(result.erros).toContain("Senha deve ter no mínimo 6 caracteres");
  });

  it("aceita dados válidos", () => {
    const result = validarUsuario({ nome: "Padre Eder", login: "padre.eder", senha: "senhaSegura123" });
    expect(result.valido).toBe(true);
    expect(result.erros).toHaveLength(0);
  });
});
