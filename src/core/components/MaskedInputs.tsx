import { useCallback } from "react";

interface MaskedInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
}

function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function CepInput({ value, onChange, style, placeholder = "00000-000", disabled }: MaskedInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskCep(e.target.value));
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    onChange(maskCep(pasted));
  }, [onChange]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={9}
      style={style}
    />
  );
}

export function PhoneInput({ value, onChange, style, placeholder = "(92) 99999-9999", disabled }: MaskedInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskPhone(e.target.value));
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    onChange(maskPhone(pasted));
  }, [onChange]);

  return (
    <input
      type="text"
      inputMode="tel"
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={15}
      style={style}
    />
  );
}
