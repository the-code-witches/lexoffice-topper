export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "yellow" | "blue";
}) {
  const accentClass = {
    green: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
  }[accent ?? "blue"];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
