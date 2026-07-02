import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "system-ui",
        textAlign: "center",
        padding: 24,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: "#dc2626" }}>
          ⚠️
        </div>
        <h2>Ocorreu um erro inesperado</h2>
        <p style={{ color: "#64748b", maxWidth: 400 }}>
          {this.state.error?.message ?? "Erro desconhecido"}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}
