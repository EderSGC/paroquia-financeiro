// src/core/components/ModeToggle.tsx
// macOS-style segmented control used across all module pages
export type ModoPagina = 'registrar' | 'buscar';

interface ModeToggleProps {
  modo: ModoPagina;
  onChange: (modo: ModoPagina) => void;
  labelRegistrar?: string;
  labelBuscar?: string;
}

export function ModeToggle({
  modo,
  onChange,
  labelRegistrar = '+ Registrar',
  labelBuscar = 'Buscar',
}: ModeToggleProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "rgba(0,0,0,0.07)",
        borderRadius: 9,
        padding: 3,
        gap: 2,
        marginBottom: 18,
        userSelect: "none",
      }}
    >
      {([
        { key: "registrar" as ModoPagina, label: labelRegistrar },
        { key: "buscar"    as ModoPagina, label: labelBuscar    },
      ] as const).map(seg => {
        const active = modo === seg.key;
        return (
          <button
            key={seg.key}
            onClick={() => onChange(seg.key)}
            style={{
              padding: "5px 16px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              fontFamily: "inherit",
              background: active ? "#FFFFFF" : "transparent",
              color: active ? "#1D1D1F" : "#8E8E93",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 120ms ease",
              whiteSpace: "nowrap",
            }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
