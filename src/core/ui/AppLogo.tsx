import { useMemo, useState } from "react";

interface AppLogoProps {
  logoPath?: string | null;
  alt: string;
  size: number;
  radius: number;
  fit?: "contain" | "cover";
  fallbackText?: string;
  background?: string;
  padding?: number;
}

export function AppLogo({
  logoPath,
  alt,
  size,
  radius,
  fit = "contain",
  background = "white",
  padding = 0,
}: AppLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [iconError, setIconError] = useState(false);

  const src = useMemo(() => {
    if (logoPath && !imageError) return logoPath;
    return null;
  }, [imageError, logoPath]);

  const sharedStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setImageError(true)}
        style={{ ...sharedStyle, objectFit: fit, background, padding }}
      />
    );
  }

  /* Fallback: usa o ícone real do app */
  if (!iconError) {
    return (
      <img
        src="/app-icon.png"
        alt={alt}
        onError={() => setIconError(true)}
        style={{ ...sharedStyle, objectFit: "contain" }}
      />
    );
  }

  /* Último fallback: letra */
  return (
    <div style={{
      ...sharedStyle,
      background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#B8860B",
      fontWeight: 700,
      fontSize: Math.max(16, Math.floor(size * 0.38)),
    }}>
      P
    </div>
  );
}
