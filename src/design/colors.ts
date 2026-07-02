/** macOS Human Interface Guidelines — adaptive palette via CSS vars */
export const colors = {
  /* ── Window background ─────────────────────────────────────── */
  background:     "var(--bg-app)",
  page:           "var(--dm-card-bg)",

  /* ── Surfaces ──────────────────────────────────────────────── */
  surface:        "var(--dm-card-bg)",
  surfaceSoft:    "var(--dm-table-head-bg)",
  surfaceMuted:   "var(--dm-table-row-alt)",
  surfaceStrong:  "var(--dm-table-row-alt)",

  /* ── Borders & dividers ─────────────────────────────────────── */
  border:         "var(--dm-card-border)",
  divider:        "var(--dm-separator)",

  /* ── Typography ─────────────────────────────────────────────── */
  text:           "var(--dm-input-color)",
  textSecondary:  "var(--dm-label-color)",
  textMuted:      "var(--dm-muted-color)",
  textInverted:   "#FFFFFF",

  /* ── Accent (macOS System Blue) ─────────────────────────────── */
  primary:        "#007AFF",
  primarySoft:    "#E5F2FF",
  primaryStrong:  "#0056D3",
  accent:         "#007AFF",

  /* ── Semantic (macOS system colors) ─────────────────────────── */
  success:        "#34C759",
  warning:        "#FF9F0A",
  danger:         "#FF3B30",

  /* ── Sidebar (translucent vibrancy) ─────────────────────────── */
  sidebar:        "rgba(232, 232, 237, 0.96)",
  sidebarBorder:  "rgba(0, 0, 0, 0.07)",
  sidebarText:    "#1D1D1F",
  sidebarMuted:   "#8E8E93",

  /* ── Glass ──────────────────────────────────────────────────── */
  glass:          "rgba(255, 255, 255, 0.72)",
};
