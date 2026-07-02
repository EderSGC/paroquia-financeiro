import type { CSSProperties } from "react";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

import { AppLogo } from "../../../core/ui/AppLogo";
import type { Paroquia, PapelUsuario } from "../../../core/types/app.types";
import { LABEL_PAPEL } from "../../../core/types/app.types";
import { createDataUrl } from "../../../core/utils/image";
import { finalizarSetup } from "../services/auth.service";
import { CepInput, PhoneInput } from "../../../core/components/MaskedInputs";

interface SetupScreenProps {
  onDone: () => void;
}

const inputStyle: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid #e5e7eb", fontSize: 14, fontFamily: "system-ui",
  outline: "none", boxSizing: "border-box", background: "#f9fafb", color: "#1a1d2e",
};

const labelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block",
};

const btnPrimary: CSSProperties = {
  width: "100%", padding: "14px 24px", border: "none", borderRadius: 10,
  background: "#4338ca", color: "white", fontWeight: 700, fontSize: 15,
  cursor: "pointer", fontFamily: "inherit",
};

const btnSecondary: CSSProperties = {
  ...btnPrimary, background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb",
};

const paroquiaInicial: Paroquia = {
  nome: "", diocese: "", cidade: "", estado: "", endereco: "", cep: "",
  email: "", telefone: "", cnpj: "", logo_path: "", diocese_logo_path: "",
};

type Passo = 1 | 2 | 3 | 4;

const PERFIS_SETUP: { valor: PapelUsuario; label: string; desc: string }[] = [
  { valor: "admin", label: "Administrador", desc: "Acesso total ao sistema, incluindo gerenciamento de usuários e backups" },
  { valor: "paroquia", label: "Pároco", desc: "Acesso total ao sistema como pároco responsável" },
  { valor: "vigario", label: "Vigário", desc: "Acesso amplo aos módulos pastorais e sacramentais" },
  { valor: "secretaria", label: "Secretária(o)", desc: "Acesso operacional para gestão do dia a dia" },
  { valor: "membro", label: "Membro de Comunidade", desc: "Acesso restrito aos dados da sua comunidade" },
];

export function SetupScreen({ onDone }: SetupScreenProps) {
  const [passo, setPasso] = useState<Passo>(1);
  const [form, setForm] = useState<Paroquia>(paroquiaInicial);
  const [login, setLogin] = useState({ nome: "", login: "", senha: "", confirmar: "" });
  const [papel, setPapel] = useState<PapelUsuario>("admin");
  const [erro, setErro] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [salvando, setSalvando] = useState(false);

  function campo<K extends keyof Paroquia>(key: K, valor: Paroquia[K]) {
    setForm((state) => ({ ...state, [key]: valor }));
  }

  async function selecionarLogo() {
    const path = await open({ filters: [{ name: "Imagem", extensions: ["png", "jpg", "jpeg"] }] });
    if (path && typeof path === "string") {
      const bytes = await readFile(path);
      const dataUrl = createDataUrl(path, new Uint8Array(bytes));
      campo("logo_path", dataUrl);
      setLogoPreview(dataUrl);
      setErro("");
    }
  }

  function validarPasso1(): boolean {
    if (!form.nome?.trim()) { setErro("Nome da paróquia é obrigatório."); return false; }
    setErro(""); return true;
  }

  function validarPasso3(): boolean {
    if (!login.nome?.trim()) { setErro("Informe seu nome completo."); return false; }
    if (!login.login?.trim()) { setErro("Informe um login."); return false; }
    if (login.login.trim().length < 3) { setErro("Login deve ter pelo menos 3 caracteres."); return false; }
    if (!login.senha?.trim()) { setErro("Informe uma senha."); return false; }
    if (login.senha.length < 6) { setErro("Senha deve ter no mínimo 6 caracteres."); return false; }
    if (login.senha !== login.confirmar) { setErro("As senhas não coincidem."); return false; }
    setErro(""); return true;
  }

  async function concluirConfiguracao() {
    if (!validarPasso3()) return;
    setSalvando(true);
    try {
      await finalizarSetup({
        paroquia: form,
        administrador: {
          nome: login.nome.trim(),
          login: login.login.trim(),
          senha: login.senha.trim(),
        },
      });

      const { getDb } = await import("@core/database");
      const db = await getDb();
      await db.execute("UPDATE usuarios SET papel=? WHERE login=?", [papel, login.login.trim()]);
      await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");

      onDone();
    } catch (error) {
      setErro("Erro ao configurar o sistema. Tente novamente.");
      console.error("Setup error:", error);
    } finally {
      setSalvando(false);
    }
  }

  function avancar() {
    if (passo === 1 && !validarPasso1()) return;
    if (passo < 4) setPasso((passo + 1) as Passo);
  }

  function voltar() {
    if (passo > 1) setPasso((passo - 1) as Passo);
    setErro("");
  }

  const containerStyle: CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", background: "linear-gradient(180deg, #f0f4ff, #e8edf8)",
    fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    padding: "40px 20px 20px",
    overflowY: "auto",
    boxSizing: "border-box",
  };

  const cardStyle: CSSProperties = {
    background: "white", borderRadius: 20, padding: 32, maxWidth: 440, width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18 }}>P</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1d2e" }}>Configuração Inicial</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {[1, 2, 3, 4].map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: p <= passo ? "#4338ca" : "#9ca3af" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: p <= passo ? "#4338ca" : "#e5e7eb", color: p <= passo ? "white" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{p}</div>
                  {p === 1 ? "Paróquia" : p === 2 ? "Perfil" : p === 3 ? "Acesso" : "Finalizar"}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ ETAPA 1: Paróquia ═══ */}
        {passo === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome da Paróquia *</label>
              <input style={inputStyle} value={form.nome} onChange={e => campo("nome", e.target.value)} placeholder="Ex: Paróquia Nossa Senhora Aparecida" />
            </div>
            <div>
              <label style={labelStyle}>Diocese</label>
              <input style={inputStyle} value={form.diocese} onChange={e => campo("diocese", e.target.value)} placeholder="Ex: Diocese de Manaus" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
              <div><label style={labelStyle}>Cidade</label><input style={inputStyle} value={form.cidade ?? ""} onChange={e => campo("cidade", e.target.value)} placeholder="Manaus" /></div>
              <div><label style={labelStyle}>Estado</label><input style={inputStyle} value={form.estado ?? ""} onChange={e => campo("estado", e.target.value)} placeholder="AM" maxLength={2} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
              <div><label style={labelStyle}>Endereço</label><input style={inputStyle} value={form.endereco} onChange={e => campo("endereco", e.target.value)} placeholder="Rua, número" /></div>
              <div><label style={labelStyle}>CEP</label><CepInput style={inputStyle} value={form.cep ?? ""} onChange={v => campo("cep", v)} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={labelStyle}>E-mail</label><input style={inputStyle} type="email" value={form.email} onChange={e => campo("email", e.target.value)} placeholder="paroquia@email.com" /></div>
              <div><label style={labelStyle}>Telefone</label><PhoneInput style={inputStyle} value={form.telefone} onChange={v => campo("telefone", v)} /></div>
            </div>
            <div>
              <label style={labelStyle}>Logo da Paróquia</label>
              <div onClick={selecionarLogo} style={{ border: "2px dashed #e5e7eb", borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", background: "#fafbfc" }}>
                {logoPreview ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <AppLogo logoPath={logoPreview} alt="Logo" size={64} radius={14} />
                    <span style={{ fontSize: 12, color: "#059669" }}>Logo selecionada</span>
                  </div>
                ) : (
                  <div>
                    <AppLogo logoPath={null} alt="Logo" size={48} radius={14} fallbackText="P" background="rgba(67,56,202,0.08)" />
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>Clique para escolher a imagem</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>PNG ou JPG. Opcional.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ETAPA 2: Perfil ═══ */}
        {passo === 2 && (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1d2e", margin: "0 0 4px" }}>Qual será sua função no sistema?</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>Isso define suas permissões de acesso.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PERFIS_SETUP.map(p => (
                <div
                  key={p.valor}
                  onClick={() => setPapel(p.valor)}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    border: papel === p.valor ? "2px solid #4338ca" : "1px solid #e5e7eb",
                    background: papel === p.valor ? "#f0f0ff" : "white",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: papel === p.valor ? "#4338ca" : "#1a1d2e" }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ETAPA 3: Login e Senha ═══ */}
        {passo === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1d2e", margin: "0 0 4px" }}>Criar seu acesso</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>Perfil selecionado: <strong style={{ color: "#4338ca" }}>{LABEL_PAPEL[papel]}</strong></p>
            <div>
              <label style={labelStyle}>Nome Completo *</label>
              <input style={inputStyle} value={login.nome} onChange={e => setLogin(s => ({ ...s, nome: e.target.value }))} placeholder="Seu nome completo" />
            </div>
            <div>
              <label style={labelStyle}>Login *</label>
              <input style={inputStyle} value={login.login} onChange={e => setLogin(s => ({ ...s, login: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") }))} placeholder="Ex: padre.joao" />
            </div>
            <div>
              <label style={labelStyle}>Senha *</label>
              <input style={inputStyle} type="password" value={login.senha} onChange={e => setLogin(s => ({ ...s, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label style={labelStyle}>Confirmar Senha *</label>
              <input style={inputStyle} type="password" value={login.confirmar} onChange={e => setLogin(s => ({ ...s, confirmar: e.target.value }))} placeholder="Repita a senha" />
            </div>
          </div>
        )}

        {/* ═══ ETAPA 4: Resumo e Finalizar ═══ */}
        {passo === 4 && (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1d2e", margin: "0 0 16px" }}>Tudo pronto!</p>
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16, fontSize: 13, lineHeight: 2 }}>
              <div><span style={{ color: "#6b7280" }}>Paróquia:</span> <strong>{form.nome || "—"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>Diocese:</span> {form.diocese || "—"}</div>
              <div><span style={{ color: "#6b7280" }}>Local:</span> {form.cidade || "—"}{form.estado ? ` / ${form.estado}` : ""}</div>
              <div><span style={{ color: "#6b7280" }}>Perfil:</span> <strong style={{ color: "#4338ca" }}>{LABEL_PAPEL[papel]}</strong></div>
              <div><span style={{ color: "#6b7280" }}>Usuário:</span> {login.nome} ({login.login})</div>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "16px 0 0", lineHeight: 1.6 }}>
              Ao clicar em "Finalizar", o sistema será configurado e você será direcionado para a tela de login.
            </p>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {passo > 1 && (
            <button onClick={voltar} style={btnSecondary}>Voltar</button>
          )}
          {passo < 4 ? (
            <button onClick={avancar} style={btnPrimary}>Continuar →</button>
          ) : (
            <button onClick={concluirConfiguracao} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.7 : 1 }}>
              {salvando ? "Configurando..." : "Finalizar Configuração ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
