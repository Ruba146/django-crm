"use client";

interface GraphLegendProps {
  categories: Array<{ key: string; label: string; count: number; color: string }>;
}

export function GraphLegend({ categories }: GraphLegendProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-2.5 py-1 shadow-sm">
      {categories.map((cat) => (
        <div key={cat.key} className="flex items-center gap-1.5">
          <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="text-[11px] text-slate-600">{cat.label}</span>
          <span className="text-[10px] font-medium text-slate-500">{cat.count}</span>
        </div>
      ))}
    </div>
  );
}
