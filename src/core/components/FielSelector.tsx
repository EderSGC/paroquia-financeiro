import { CSSProperties, useState, useEffect } from "react";
import { getDb } from "@core/database";

interface FielOption {
  id: number | string;
  nome: string;
}

interface FielSelectorProps {
  fieis?: FielOption[];
  value: string | number;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  style?: CSSProperties;
}

export function FielSelector({
  fieis,
  value,
  onChange,
  label = "Selecionar Fiel",
  placeholder = "Selecione um fiel...",
  style = {},
}: FielSelectorProps) {
  const [localFieis, setLocalFieis] = useState<FielOption[]>(
    fieis ?? []
  );

  useEffect(() => {
    if (fieis && fieis.length > 0) {
      setLocalFieis(fieis);
      return;
    }

    let active = true;

    getDb()
      .then((db) =>
        db.select<FielOption[]>(
          "SELECT id, nome FROM fieis WHERE deleted_at IS NULL ORDER BY nome ASC"
        )
      )
      .then((data) => {
        if (active) {
          setLocalFieis(data);
        }
      })
      .catch((error) => {
        console.error(
          "Erro ao carregar fiéis para o seletor:",
          error
        );
      });

    return () => {
      active = false;
    };
  }, [fieis]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...style,
      }}
    >
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#344054",
        }}
      >
        {label}
      </label>

      <select
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 8,
          border: "1px solid #d0d5dd",
          backgroundColor: "#fff",
          fontSize: 14,
          color: "#0f172a",
        }}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value="">
          {placeholder}
        </option>

        {localFieis.map((fiel) => (
          <option
            key={fiel.id}
            value={fiel.id}
          >
            {fiel.nome}
          </option>
        ))}
      </select>
    </div>
  );
}