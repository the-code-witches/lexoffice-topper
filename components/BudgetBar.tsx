import { formatEur } from "@/lib/calculations";

export function BudgetBar({
  label,
  spent,
  budget,
  sub,
  onClick,
  expanded,
}: {
  label: string;
  spent: number;
  budget: number;
  sub?: string;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const remaining = budget - spent;
  const over = remaining < 0;

  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900 p-5 ${onClick ? "cursor-pointer hover:border-gray-600 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="font-medium text-white flex items-center gap-2">
            {label}
            {onClick && (
              <span className="text-xs text-gray-500">{expanded ? "▲" : "▼"}</span>
            )}
          </p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${over ? "text-red-400" : "text-emerald-400"}`}>
            {formatEur(remaining)} {over ? "überzogen" : "übrig"}
          </p>
          <p className="text-xs text-gray-500">
            {formatEur(spent)} von {formatEur(budget)}
          </p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-gray-800">
        <div
          className={`h-2 rounded-full transition-all ${over ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
