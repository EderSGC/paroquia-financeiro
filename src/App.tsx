import "./App.css";

import { useEffect, useState, useCallback, useRef } from "react";
import { ToastProvider } from "./core/ui/Toast";
import { UpdateChecker } from "./core/ui/UpdateChecker";

import { getParoquiaAtual, registrarLogout } from "./modules/auth/services/auth.service";
import { iniciarBackupAutomatico, pararBackupAutomatico } from "./core/services/backup.service";
import { garantirPastaDocumentos } from "./core/utils/pdfGenerator";
import { SECURITY } from "./core/config/constants";
import { setCurrentUserId } from "./core/repository/BaseRepository";

import {
  LoginScreen,
  SetupScreen,
  SplashScreen,
} from "./modules/auth";

import { MacOSWorkspaceLayout } from "./layouts/MacOSWorkspaceLayout";

import type {
  Paroquia,
  Tela,
  Usuario,
} from "./core/types/app.types";

export default function App() {
  const [tela, setTela] = useState<Tela>("splash");

  const [paroquia, setParoquia] =
    useState<Paroquia | null>(null);

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      setUsuario(null);
      setTela("login");
    }, SECURITY.SESSION_TIMEOUT_MS);
  }, []);

  // Reinicia o timer de sessão em qualquer interação do usuário
  useEffect(() => {
    if (tela !== "app") return;
    const eventos = ["mousedown", "keydown", "touchstart", "scroll"];
    eventos.forEach(e => window.addEventListener(e, resetSessionTimer, { passive: true }));
    resetSessionTimer();
    return () => {
      eventos.forEach(e => window.removeEventListener(e, resetSessionTimer));
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, [tela, resetSessionTimer]);

  const carregarSistema = useCallback(async () => {
    try {
      setLoading(true);
      garantirPastaDocumentos().catch(() => {});

      const paroquiaAtual =
        await getParoquiaAtual();

      if (paroquiaAtual?.nome) {
        setParoquia(paroquiaAtual);
      }
    } catch (err) {
      console.error(
        "Erro ao carregar paróquia:",
        err
      );

      setError(
        "Erro ao carregar os dados do sistema."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarSistema();
  }, [carregarSistema]);

  const finalizarSplash = () => {
    setTela(
      paroquia?.nome
        ? "login"
        : "setup"
    );
  };

  const finalizarSetup = async () => {
    try {
      const paroquiaAtual = await getParoquiaAtual();
      if (paroquiaAtual) {
        setParoquia(paroquiaAtual);
      }
      setTela("login");
    } catch (err) {
      console.error("Erro ao finalizar setup:", err);
      setError("Erro ao finalizar configuração.");
    }
  };

  const realizarLogin = (
    usuarioAtual: Usuario
  ) => {
    setUsuario(usuarioAtual);
    setCurrentUserId(usuarioAtual.id);
    iniciarBackupAutomatico();
    setTela("app");
  };

  const realizarLogout = () => {
    pararBackupAutomatico();
    if (usuario) {
      registrarLogout(usuario.id, usuario.nome).catch(() => {});
      setCurrentUserId(0);
    }
    setUsuario(null);
    setTela("login");
  };

  if (loading || tela === "splash") {
    return (
      <SplashScreen
        paroquia={paroquia}
        onDone={finalizarSplash}
      />
    );
  }

  if (error) {
    return (
      <div className="page-overlay">
        <div className="error-card">
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
              color: "#dc2626",
            }}
          >
            ⚠️
          </div>

          <h2>
            Erro ao carregar o sistema
          </h2>

          <p>{error}</p>

          <button
            onClick={() =>
              window.location.reload()
            }
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  if (tela === "setup") {
    return (
      <SetupScreen
        onDone={finalizarSetup}
      />
    );
  }

  if (
    tela === "login" &&
    paroquia
  ) {
    return (
      <LoginScreen
        paroquia={paroquia}
        onLogin={realizarLogin}
      />
    );
  }

  if (
    tela === "app" &&
    paroquia &&
    usuario
  ) {
    return (
      <ToastProvider>
        <MacOSWorkspaceLayout
          paroquia={paroquia}
          usuario={usuario}
          onParoquiaUpdate={setParoquia}
          onLogout={realizarLogout}
        />
        <UpdateChecker />
      </ToastProvider>
    );
  }

  return (
    <div className="page-overlay">
      <div
        style={{
          textAlign: "center",
          color: "#475569",
        }}
      >
        <div
          style={{
            fontSize: 14,
          }}
        >
          Inicializando sistema...
        </div>
      </div>
    </div>
  );
}