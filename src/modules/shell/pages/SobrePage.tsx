interface Props {
  onFechar: () => void;
}

export function SobrePage({ onFechar }: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onFechar}
    >
      <div
        style={{
          background: "white", borderRadius: 20, padding: 40,
          maxWidth: 480, width: "100%", textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ícone */}
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: "linear-gradient(135deg, #1f3b73, #3d5a9e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px", fontSize: 36,
        }}>
          ⛪
        </div>

        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#1a1d2e" }}>
          Financeiro Paroquial
        </h1>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#667085" }}>
          Versão 1.0.0
        </p>

        <hr style={{ border: "none", borderTop: "1px solid #e4e7ec", margin: "20px 0" }} />

        <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#344054", textAlign: "left" }}>
          {[
            ["Plataforma", "Tauri + React + TypeScript"],
            ["Banco de dados", "SQLite (local, criptografado)"],
            ["Sistema operacional", navigator.platform],
            ["Copyright", `© ${new Date().getFullYear()} Financeiro Paroquial`],
          ].map(([label, valor]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontWeight: 600, color: "#667085" }}>{label}</span>
              <span style={{ color: "#1a1d2e", textAlign: "right" }}>{valor}</span>
            </div>
          ))}
        </div>

        <p style={{ margin: "20px 0 0", fontSize: 12, color: "#98a2b3", lineHeight: 1.6 }}>
          Desenvolvido para a gestão eficiente de paróquias e comunidades católicas.
          Todos os dados são armazenados localmente neste dispositivo.
        </p>

        <button
          onClick={onFechar}
          style={{
            marginTop: 24, padding: "12px 32px",
            background: "#1f3b73", color: "white",
            border: "none", borderRadius: 10,
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            width: "100%",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
