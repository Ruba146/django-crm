"use client";

import { TOOLTIP_STYLE } from "@/utils/chart-theme";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value: unknown;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  labelFormatter?: (label: string) => string;
  formatter?: (value: unknown, name?: string, props?: Record<string, unknown>) => [string, string];
  className?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  className = "",
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const formatLabel = labelFormatter
    ? labelFormatter(String(label ?? ""))
    : String(label ?? "");

  return (
    <div
      className={["reports-tooltip", className].join(" ")}
      style={TOOLTIP_STYLE}
    >
      {formatLabel && (
        <p className="reports-tooltip-label mb-1 text-xs font-medium text-gray-300">
          {formatLabel}
        </p>
      )}
      <div className="reports-tooltip-list space-y-0.5">
        {payload.map((entry, index) => {
          const [formattedValue, formattedName] = formatter
            ? formatter(entry.value, entry.name, entry.payload)
            : [String(entry.value), String(entry.name ?? entry.dataKey ?? "")];

          return (
            <div
              key={index}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-gray-300">{formattedName}</span>
              <span className="font-medium text-white">{formattedValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
