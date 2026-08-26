export const CHART_COLORS = {
  blue: "#3b82f6",
  blueDark: "#1d4ed8",
  green: "#10b981",
  greenDark: "#047857",
  amber: "#f59e0b",
  amberDark: "#b45309",
  red: "#ef4444",
  redDark: "#b91c1c",
  purple: "#8b5cf6",
  purpleDark: "#6d28d9",
  pink: "#ec4899",
  pinkDark: "#be185d",
  teal: "#14b8a6",
  tealDark: "#0f766e",
  orange: "#f97316",
  orangeDark: "#c2410c",
  slate: "#64748b",
  slateDark: "#334155",
} as const;

export const BAR_CHART_COLORS = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.purple, CHART_COLORS.teal, CHART_COLORS.orange, CHART_COLORS.slate] as const;

export const PIE_CHART_COLORS = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.purple, CHART_COLORS.pink, CHART_COLORS.teal, CHART_COLORS.orange] as const;

export const WIN_LOSS_COLORS = {
  won: CHART_COLORS.green,
  wonDark: CHART_COLORS.greenDark,
  lost: CHART_COLORS.red,
  lostDark: CHART_COLORS.redDark,
  open: CHART_COLORS.amber,
  openDark: CHART_COLORS.amberDark,
} as const;

export function darkenColor(hex: string, percent = 20): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff00) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
}

export const TOOLTIP_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "0.5rem",
  color: "#ffffff",
  fontSize: "12px",
  lineHeight: "1.5",
} as const;

export const TOOLTIP_CURSOR_STYLE = {
  fill: "rgba(17, 24, 39, 0.1)",
  stroke: "#374151",
} as const;
