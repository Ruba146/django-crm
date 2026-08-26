"use client";

import { Cell } from "recharts";
import { usePieHover } from "@/components/reports/use-pie-hover";

interface PieCellWithHoverProps {
  index: number;
  colorIndex: number;
}

export function PieCellWithHover({ index, colorIndex }: PieCellWithHoverProps) {
  const { fill, handleMouseEnter, handleMouseLeave } = usePieHover(colorIndex);

  return (
    <Cell
      key={`cell-${index}`}
      fill={fill}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ transition: "fill 200ms ease" }}
    />
  );
}
