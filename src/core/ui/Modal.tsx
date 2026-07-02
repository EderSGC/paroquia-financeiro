// src/core/ui/Modal.tsx
import { useEffect } from "react";
import { colors, spacing, typography } from "../../design";

interface ModalProps {
  aberto: boolean;
  titulo: string;
  children: React.ReactNode;
  onFechar?: () => void;
  largura?: number;
}

export function Modal({ aberto, titulo, children, onFechar, largura = 480 }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && onFechar) onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.surface,
          borderRadius: 16,
          width: "100%", maxWidth: largura,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: `${spacing.md}px ${spacing.xl}px`,
          borderBottom: `1px solid ${colors.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontWeight: 700, fontSize: typography.fontSize.base, color: colors.text }}>{titulo}</span>
          {onFechar && (
            <button onClick={onFechar} style={{
              background: "none", border: "none", cursor: "pointer",
              color: colors.textMuted, fontSize: 20, lineHeight: 1, padding: 4,
            }}>×</button>
          )}
        </div>
        <div style={{ padding: spacing.xl }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Modal de Confirmação ───────────────────────────────────────────────────
interface ModalConfirmProps {
  aberto: boolean;
  titulo?: string;
  mensagem: string;
  textoBotaoOk?: string;
  textoBotaoCancelar?: string;
  cor?: "danger" | "warning" | "primary";
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirm({
  aberto, titulo = "Confirmar", mensagem,
  textoBotaoOk = "Confirmar", textoBotaoCancelar = "Cancelar",
  cor = "danger", onConfirmar, onCancelar,
}: ModalConfirmProps) {
  const corMap = { danger: colors.danger, warning: colors.warning, primary: colors.primary };

  return (
    <Modal aberto={aberto} titulo={titulo} onFechar={onCancelar} largura={400}>
      <p style={{ margin: "0 0 24px", color: colors.textSecondary, lineHeight: 1.6 }}>{mensagem}</p>
      <div style={{ display: "flex", gap: spacing.sm, justifyContent: "flex-end" }}>
        <button onClick={onCancelar} style={{
          padding: "9px 20px", borderRadius: 8, border: `1px solid ${colors.border}`,
          background: colors.surface, color: colors.text, cursor: "pointer",
          fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, fontWeight: 500,
        }}>{textoBotaoCancelar}</button>
        <button onClick={onConfirmar} style={{
          padding: "9px 20px", borderRadius: 8, border: "none",
          background: corMap[cor], color: "#fff", cursor: "pointer",
          fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, fontWeight: 600,
        }}>{textoBotaoOk}</button>
      </div>
    </Modal>
  );
}

// ─── Modal de Alerta / Sucesso ──────────────────────────────────────────────
interface ModalAlertProps {
  aberto: boolean;
  titulo?: string;
  mensagem: string;
  tipo?: "sucesso" | "erro" | "aviso" | "info";
  onFechar: () => void;
}

const ICONES = { sucesso: "✅", erro: "❌", aviso: "⚠️", info: "ℹ️" };

export function ModalAlert({ aberto, titulo, mensagem, tipo = "info", onFechar }: ModalAlertProps) {
  const tituloFinal = titulo ?? { sucesso: "Sucesso", erro: "Erro", aviso: "Atenção", info: "Informação" }[tipo];
  return (
    <Modal aberto={aberto} titulo={`${ICONES[tipo]} ${tituloFinal}`} onFechar={onFechar} largura={400}>
      <p style={{ margin: "0 0 24px", color: colors.textSecondary, lineHeight: 1.6 }}>{mensagem}</p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onFechar} style={{
          padding: "9px 24px", borderRadius: 8, border: "none",
          background: colors.primary, color: "#fff", cursor: "pointer",
          fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, fontWeight: 600,
        }}>OK</button>
      </div>
    </Modal>
  );
}
