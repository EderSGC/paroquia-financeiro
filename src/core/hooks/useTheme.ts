import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
export type Palette = "azul" | "verde" | "roxo" | "bordo" | "dourado" | "petroleo" | "cinza";

export const PALETTES: { id: Palette; label: string; color: string }[] = [
  { id: "azul",     label: "Azul Royal",      color: "#1A6FD8" },
  { id: "verde",    label: "Verde Esmeralda",  color: "#059669" },
  { id: "roxo",     label: "Roxo Litúrgico",   color: "#7c3aed" },
  { id: "bordo",    label: "Bordô",            color: "#9f1239" },
  { id: "dourado",  label: "Dourado",          color: "#b45309" },
  { id: "petroleo", label: "Azul Petróleo",    color: "#0d9488" },
  { id: "cinza",    label: "Cinza Elegante",   color: "#475569" },
];

function applyTheme(theme: Theme, systemDark: boolean) {
  const effective = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", effective);
  document.body.setAttribute("data-theme", effective);
}

function applyPalette(palette: Palette) {
  if (palette === "azul") {
    document.documentElement.removeAttribute("data-palette");
  } else {
    document.documentElement.setAttribute("data-palette", palette);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("tema") as Theme) ?? "system";
  });

  const [palette, setPalette] = useState<Palette>(() => {
    return (localStorage.getItem("paleta") as Palette) ?? "azul";
  });

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    applyTheme(theme, systemDark);
    localStorage.setItem("tema", theme);
  }, [theme, systemDark]);

  useEffect(() => {
    applyPalette(palette);
    localStorage.setItem("paleta", palette);
  }, [palette]);

  const isDark = theme === "dark" || (theme === "system" && systemDark);

  return { theme, setTheme, isDark, palette, setPalette };
}
