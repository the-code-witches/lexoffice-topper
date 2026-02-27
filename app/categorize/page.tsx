"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEur } from "@/lib/calculations";
import type { AppConfig } from "@/lib/config";

interface UncategorizedVoucher {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  contactName?: string;
  remark?: string;
  netAmount: number;
  grossAmount: number;
  category: null;
}

type CategoryOption = { id: string; label: string };

function CategoryButton({
  label,
  onClick,
  saving,
}: {
  label: string;
  onClick: () => void;
  saving: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white transition-colors disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function CategorizePage() {
  const [vouchers, setVouchers] = useState<UncategorizedVoucher[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [ruleTarget, setRuleTarget] = useState<{ voucherId: string; contactName: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/expenses/uncategorized");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVouchers(data.uncategorized);
      setConfig(data.config);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories: CategoryOption[] = config
    ? [
        ...config.people.map((p) => ({ id: p.id, label: p.name })),
        { id: "internal", label: config.internal.name },
        { id: "tax", label: "Steuer (USt-Zahlung)" },
      ]
    : [];

  async function categorize(
    voucherId: string,
    category: string,
    opts?: { asRule?: boolean; ruleMatch?: string; note?: string }
  ) {
    setSaving(voucherId);
    try {
      const res = await fetch("/api/config/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId,
          category,
          asRule: opts?.asRule,
          ruleMatch: opts?.ruleMatch,
          note: opts?.note,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Fehler");

      setRuleTarget(null);

      // Use the updated list returned from the server — no Lexoffice re-fetch
      if (data.uncategorized !== null) {
        setVouchers(data.uncategorized);
      } else {
        await load();
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Kategorisieren</h1>
        <button
          onClick={load}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Aktualisieren
        </button>
      </div>

      {loading && <p className="text-gray-500 animate-pulse">Lade nicht kategorisierte Ausgaben…</p>}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950 p-5 text-red-300">
          <p className="font-medium mb-1">Fehler</p>
          <p className="text-sm font-mono">{error}</p>
        </div>
      )}

      {!loading && !error && vouchers.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-500">
          Alle Ausgaben sind kategorisiert.
        </div>
      )}

      {!loading && !error && vouchers.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-xs text-gray-500">
            {vouchers.length} nicht kategorisiert
          </div>
          <div className="divide-y divide-gray-800">
            {vouchers.map((v) => (
              <div key={v.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">
                        {v.contactName ?? "Unbekannt"}
                      </span>
                      <span className="text-xs text-gray-500">{v.voucherNumber}</span>
                      <span className="text-xs text-gray-500">{v.voucherDate}</span>
                    </div>
                    {v.remark && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{v.remark}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-semibold">{formatEur(v.netAmount)}</p>
                    <p className="text-xs text-gray-500">netto</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <CategoryButton
                      key={cat.id}
                      label={cat.label}
                      saving={saving === v.id}
                      onClick={() => categorize(v.id, cat.id)}
                    />
                  ))}

                  {v.contactName && (
                    <button
                      onClick={() =>
                        setRuleTarget(
                          ruleTarget?.voucherId === v.id
                            ? null
                            : { voucherId: v.id, contactName: v.contactName! }
                        )
                      }
                      className="rounded-lg border border-dashed border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Als Regel speichern…
                    </button>
                  )}
                </div>

                {ruleTarget?.voucherId === v.id && (
                  <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3">
                    <p className="text-xs text-gray-400">
                      Regel für{" "}
                      <span className="text-white font-medium">
                        &quot;{ruleTarget.contactName}&quot;
                      </span>{" "}
                      — alle zukünftigen Ausgaben dieses Anbieters werden automatisch zugeordnet.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <CategoryButton
                          key={cat.id}
                          label={`→ ${cat.label}`}
                          saving={saving === v.id}
                          onClick={() =>
                            categorize(v.id, cat.id, {
                              asRule: true,
                              ruleMatch: ruleTarget.contactName,
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
