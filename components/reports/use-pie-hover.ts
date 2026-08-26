"use client";

import { useState, useCallback } from "react";
import { darkenColor, PIE_CHART_COLORS } from "@/utils/chart-theme";

export function usePieHover(colorIndex: number) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const fill = isHovered
    ? darkenColor(PIE_CHART_COLORS[colorIndex % PIE_CHART_COLORS.length], 20)
    : PIE_CHART_COLORS[colorIndex % PIE_CHART_COLORS.length];

  return { fill, handleMouseEnter, handleMouseLeave, isHovered };
}
