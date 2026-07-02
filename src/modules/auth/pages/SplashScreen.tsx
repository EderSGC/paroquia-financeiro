import { useEffect, useState, useCallback } from "react";
import type { Paroquia } from "../../../core/types/app.types";
import { BRAND_IMAGE_SRC } from "../../../core/utils/image";

interface SplashScreenProps {
  paroquia: Paroquia | null;
  onDone: () => void;
}

const VERSION = "1.6.0";
const YEAR = new Date().getFullYear();

interface LoadingStep {
  label: string;
  action?: () => Promise<void>;
}

const STEPS: LoadingStep[] = [
  { label: "Inicializando Sistema..." },
  {
    label: "Carregando Banco de Dados...",
    action: async () => {
      const { getDb } = await import("../../../core/database");
      await getDb();
    },
  },
  { label: "Verificando Configurações..." },
  { label: "Carregando Módulos..." },
  { label: "Preparando Interface..." },
  { label: "Finalizando Inicialização..." },
];

export function SplashScreen({ paroquia, onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState(STEPS[0].label);
  const [shimmerActive, setShimmerActive] = useState(false);

  const runSteps = useCallback(async () => {
    const totalSteps = STEPS.length;

    for (let i = 0; i < totalSteps; i++) {
      const step = STEPS[i];
      setStepLabel(step.label);
      setProgress(((i) / totalSteps) * 100);

      try {
        if (step.action) {
          await step.action();
        } else {
          await new Promise(r => setTimeout(r, 350));
        }
      } catch {
        await new Promise(r => setTimeout(r, 200));
      }

      setProgress(((i + 1) / totalSteps) * 100);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const t1 = setTimeout(() => {
      if (!cancelled) setPhase("visible");
    }, 50);

    const t2 = setTimeout(() => {
      if (!cancelled) setShimmerActive(true);
    }, 600);

    const startLoading = async () => {
      await new Promise(r => setTimeout(r, 800));
      if (cancelled) return;

      await runSteps();
      if (cancelled) return;

      await new Promise(r => setTimeout(r, 600));
      if (cancelled) return;

      setPhase("exit");

      await new Promise(r => setTimeout(r, 700));
      if (!cancelled) onDone();
    };

    startLoading();

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone, runSteps]);

  const opacity = phase === "enter" ? 0 : phase === "exit" ? 0 : 1;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#050b17",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      opacity,
      transition: "opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
      overflow: "hidden",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* Background com imagem + overlay gradiente */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${BRAND_IMAGE_SRC})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(1px) brightness(0.35)",
        transform: "scale(1.05)",
      }} />

      {/* Partículas de luz ambiente */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: 200 + i * 60,
            height: 200 + i * 60,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(212,175,85,${0.04 + i * 0.008}) 0%, transparent 70%)`,
            left: `${15 + i * 12}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `float-particle ${8 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.7}s`,
          }} />
        ))}
      </div>

      {/* Gradient overlay superior e inferior */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(5,11,23,0.6) 0%, rgba(5,11,23,0.3) 40%, rgba(5,11,23,0.5) 70%, rgba(5,11,23,0.85) 100%)",
        pointerEvents: "none",
      }} />

      {/* Shimmer lateral */}
      {shimmerActive && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(105deg, transparent 40%, rgba(212,175,85,0.03) 45%, rgba(212,175,85,0.06) 50%, rgba(212,175,85,0.03) 55%, transparent 60%)",
          animation: "shimmer-sweep 4s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}

      {/* Conteúdo central */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 0,
        maxWidth: 480, width: "100%", padding: "0 32px",
      }}>

        {/* Ícone do app com glow */}
        <div style={{
          position: "relative",
          marginBottom: 28,
          animation: phase === "visible" ? "logo-enter 1s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          opacity: phase === "enter" ? 0 : 1,
        }}>
          <div style={{
            position: "absolute", inset: -20,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,85,0.15) 0%, transparent 70%)",
            animation: "glow-pulse 3s ease-in-out infinite",
          }} />
          <img
            src="/app-icon.png"
            alt="Financeiro Paroquial"
            style={{
              width: 88, height: 88,
              borderRadius: 22,
              boxShadow: "0 8px 40px rgba(212,175,85,0.25), 0 0 80px rgba(212,175,85,0.1)",
              position: "relative",
            }}
          />
        </div>

        {/* Nome do sistema */}
        <div style={{
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.3px",
          textAlign: "center",
          marginBottom: 4,
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
        }}>
          Financeiro Paroquial
        </div>

        {/* Nome da paróquia */}
        {paroquia?.nome && (
          <div style={{
            color: "#d4af55",
            fontSize: 14,
            fontWeight: 600,
            textAlign: "center",
            letterSpacing: "0.02em",
            marginBottom: 2,
          }}>
            {paroquia.nome}
          </div>
        )}

        {/* Diocese */}
        {paroquia?.diocese && (
          <div style={{
            color: "rgba(200, 211, 240, 0.7)",
            fontSize: 12,
            textAlign: "center",
            marginBottom: 0,
          }}>
            {paroquia.diocese}
          </div>
        )}

        {/* Barra de progresso */}
        <div style={{
          width: "100%",
          maxWidth: 320,
          marginTop: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}>
          {/* Track da barra */}
          <div style={{
            width: "100%",
            height: 3,
            borderRadius: 3,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            position: "relative",
          }}>
            {/* Preenchimento */}
            <div style={{
              height: "100%",
              borderRadius: 3,
              background: "linear-gradient(90deg, #d4af55, #f0d078, #d4af55)",
              backgroundSize: "200% 100%",
              animation: "bar-shimmer 2s linear infinite",
              width: `${progress}%`,
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 0 12px rgba(212,175,85,0.4)",
            }} />
          </div>

          {/* Mensagem de status */}
          <div style={{
            color: "rgba(200, 211, 240, 0.6)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textAlign: "center",
            minHeight: 16,
            transition: "opacity 0.3s ease",
          }}>
            {stepLabel}
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{
        position: "absolute",
        bottom: 24,
        left: 0, right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        zIndex: 2,
      }}>
        <div style={{
          color: "rgba(200, 211, 240, 0.3)",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          Versão {VERSION}
        </div>
        <div style={{
          color: "rgba(200, 211, 240, 0.2)",
          fontSize: 9,
          letterSpacing: "0.04em",
        }}>
          © {YEAR} Financeiro Paroquial. Todos os direitos reservados.
        </div>
      </div>

      {/* Animações CSS */}
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-15px) translateX(8px); }
          66% { transform: translateY(10px) translateX(-5px); }
        }
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes logo-enter {
          from { opacity: 0; transform: scale(0.85) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bar-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
