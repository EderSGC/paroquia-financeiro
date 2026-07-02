import { useState } from "react";

import { AppLogo } from "../../../core/ui/AppLogo";
import type { Paroquia, Usuario } from "../../../core/types/app.types";
import { autenticarUsuario, redefinirSenha, verificarPerguntaSeguranca } from "../services/auth.service";
import { logger } from "@core/utils/logger";

interface LoginScreenProps {
  paroquia: Paroquia;
  onLogin: (usuario: Usuario) => void;
}

export function LoginScreen({ paroquia, onLogin }: LoginScreenProps) {
  const [modo, setModo] = useState<"login" | "redefinir">("login");
  const [loginVal, setLoginVal] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [nomeRecuperacao, setNomeRecuperacao] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmacaoSenha, setMostrarConfirmacaoSenha] = useState(false);
  const [perguntaSeguranca, setPerguntaSeguranca] = useState<string | null>(null);
  const [respostaSeguranca, setRespostaSeguranca] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    fontSize: 14,
    fontFamily: "system-ui",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  function irParaLogin() {
    setModo("login");
    setErro("");
    setMensagem("");
    setSenha("");
    setNomeRecuperacao("");
    setNovaSenha("");
    setConfirmarNovaSenha("");
    setRespostaSeguranca("");
    setPerguntaSeguranca(null);
    setMostrarSenha(false);
    setMostrarNovaSenha(false);
    setMostrarConfirmacaoSenha(false);
  }

  function irParaRedefinicao() {
    setModo("redefinir");
    setErro("");
    setMensagem("");
    setSenha("");
    setRespostaSeguranca("");
    setPerguntaSeguranca(null);
  }

  async function entrar() {
    if (!loginVal || !loginVal.trim()) {
      setErro("Digite seu login para continuar.");
      return;
    }

    if (!senha || !senha.trim()) {
      setErro("Digite sua senha para continuar.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      logger.log("Iniciando autenticação para:", loginVal);
      const usuario = await autenticarUsuario(loginVal, senha);

      if (usuario) {
        logger.log("Autenticação bem-sucedida:", usuario.nome);
        onLogin(usuario);
      } else {
        logger.warn("Falha na autenticação: credenciais inválidas");
        setErro("Login ou senha incorretos. Verifique com cuidado e tente novamente.");
      }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido";
      console.error("Erro durante autenticação:", mensagem);
      setErro("Erro ao conectar ao sistema. Verifique sua conexão e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarPerguntaSeguranca() {
    if (!loginVal.trim()) return;
    const pergunta = await verificarPerguntaSeguranca(loginVal);
    setPerguntaSeguranca(pergunta);
  }

  async function salvarNovaSenha() {
    if (!loginVal || !loginVal.trim()) {
      setErro("Informe seu login para continuar.");
      return;
    }

    if (!nomeRecuperacao || !nomeRecuperacao.trim()) {
      setErro("Informe seu nome completo exatamente como está cadastrado.");
      return;
    }

    if (perguntaSeguranca && (!respostaSeguranca || !respostaSeguranca.trim())) {
      setErro("Responda a pergunta de segurança.");
      return;
    }

    if (!novaSenha || !novaSenha.trim()) {
      setErro("Informe a nova senha.");
      return;
    }

    if (!confirmarNovaSenha || !confirmarNovaSenha.trim()) {
      setErro("Confirme a nova senha.");
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setErro("As senhas não coincidem. Verifique com cuidado.");
      return;
    }

    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCarregando(true);
    setErro("");
    setMensagem("");

    try {
      const redefiniu = await redefinirSenha(loginVal, nomeRecuperacao, novaSenha, respostaSeguranca || undefined);

      if (!redefiniu) {
        setErro("Não encontramos cadastro com esse login e esse nome completo.");
        return;
      }

      logger.log("Senha redefinida com sucesso");
      setMensagem("✅ Senha atualizada com sucesso! Agora você pode entrar com a nova senha.");
      setSenha("");
      setLoginVal("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      setNomeRecuperacao("");
      setModo("login");
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido";
      console.error("Erro ao redefinir senha:", mensagem);
      setErro("Não foi possível atualizar a senha. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function renderPasswordField({
    label,
    placeholder,
    value,
    onChange,
    onSubmit,
    visible,
    onToggle,
  }: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    visible: boolean;
    onToggle: () => void;
  }) {
    return (
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#8E8E93",
            display: "block",
            marginBottom: 4,
          }}
        >
          {label}
        </label>
        <div style={{ position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingRight: 88 }}
            type={visible ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onSubmit()}
          />
          <button
            type="button"
            onClick={onToggle}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: "#007AFF",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#F0F0F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
      }}
    >
      <div style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <AppLogo
              logoPath={paroquia.logo_path}
              alt="Logo da paróquia"
              size={78}
              radius={18}
              fallbackText={paroquia.nome?.[0] ?? "P"}
              background="white"
              padding={4}
            />
          </div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1D1D1F" }}>
            {paroquia.nome}
          </h1>
          {paroquia.diocese && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8E8E93" }}>
              {paroquia.diocese}
            </p>
          )}
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 14,
            border: "0.5px solid rgba(0,0,0,0.10)",
            padding: "28px 28px",
          }}
        >
          <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "#1D1D1F" }}>
            {modo === "login" ? "Acesso ao sistema" : "Redefinir senha"}
          </h2>
          <p style={{ margin: "0 0 16px", color: "#8E8E93", fontSize: 13, lineHeight: 1.5 }}>
            {modo === "login"
              ? "Entre com calma. Se esquecer a senha, o próprio sistema pode ajudar a criar uma nova."
              : "Informe o login e o nome completo exatamente como estão cadastrados para criar uma nova senha."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#8E8E93",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Login
              </label>
              <input
                style={inputStyle}
                placeholder="Ex: padre.eder"
                value={loginVal}
                onChange={(event) => setLoginVal(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" && (modo === "login" ? entrar() : salvarNovaSenha())
                }
              />
            </div>
            {modo === "login" ? (
              renderPasswordField({
                label: "Senha",
                placeholder: "Digite sua senha",
                value: senha,
                onChange: setSenha,
                onSubmit: entrar,
                visible: mostrarSenha,
                onToggle: () => setMostrarSenha((state) => !state),
              })
            ) : (
              <>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8E8E93",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Nome completo
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Exatamente como foi cadastrado"
                    value={nomeRecuperacao}
                    onChange={(event) => setNomeRecuperacao(event.target.value)}
                    onBlur={carregarPerguntaSeguranca}
                    onKeyDown={(event) => event.key === "Enter" && salvarNovaSenha()}
                  />
                </div>
                {perguntaSeguranca && (
                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#8E8E93",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {perguntaSeguranca}
                    </label>
                    <input
                      style={inputStyle}
                      placeholder="Digite sua resposta"
                      value={respostaSeguranca}
                      onChange={(event) => setRespostaSeguranca(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && salvarNovaSenha()}
                    />
                  </div>
                )}
                {renderPasswordField({
                  label: "Nova senha",
                  placeholder: "Escolha uma senha fácil de lembrar",
                  value: novaSenha,
                  onChange: setNovaSenha,
                  onSubmit: salvarNovaSenha,
                  visible: mostrarNovaSenha,
                  onToggle: () => setMostrarNovaSenha((state) => !state),
                })}
                {renderPasswordField({
                  label: "Confirmar nova senha",
                  placeholder: "Repita a senha escolhida",
                  value: confirmarNovaSenha,
                  onChange: setConfirmarNovaSenha,
                  onSubmit: salvarNovaSenha,
                  visible: mostrarConfirmacaoSenha,
                  onToggle: () => setMostrarConfirmacaoSenha((state) => !state),
                })}
              </>
            )}
            {erro && <p style={{ color: "#dc2626", fontSize: 12, margin: 0 }}>{erro}</p>}
            {mensagem && <p style={{ color: "#15803d", fontSize: 12, margin: 0 }}>{mensagem}</p>}
            <button
              onClick={modo === "login" ? entrar : salvarNovaSenha}
              disabled={carregando}
              style={{
                background: "#007AFF",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 4,
                opacity: carregando ? 0.7 : 1,
              }}
            >
              {modo === "login"
                ? carregando
                  ? "Entrando..."
                  : "Entrar"
                : carregando
                  ? "Salvando..."
                  : "Salvar nova senha"}
            </button>
            <button
              onClick={modo === "login" ? irParaRedefinicao : irParaLogin}
              type="button"
              style={{
                background: "transparent",
                color: "#007AFF",
                border: "none",
                padding: 0,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {modo === "login" ? "Esqueci minha senha" : "Voltar para o login"}
            </button>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "#d1d5db", marginTop: 20 }}>
          Financeiro Paroquial · {paroquia.cidade} {paroquia.estado}
        </p>
      </div>
    </div>
  );
}
