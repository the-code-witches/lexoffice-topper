"use client";

import { useState } from "react";
import { formatEur } from "@/lib/calculations";
import type { ExpenseSplit } from "@/lib/config";

interface Expense {
  voucherId: string;
  category: string;
  amount: number;
  amountForCalc?: number;
  date: string;
  contactName?: string;
  remark?: string;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function ExpenseTable({
  expenses,
  splits,
  onSplitChange,
}: {
  expenses: Expense[];
  splits: ExpenseSplit[];
  onSplitChange: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ months: number; start_month: string }>({
    months: 12,
    start_month: currentMonth(),
  });

  const splitMap = new Map(splits.map((s) => [s.voucher_id, s]));

  async function saveSplit(voucherId: string) {
    await fetch("/api/config/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucher_id: voucherId, ...form }),
    });
    setEditing(null);
    onSplitChange();
  }

  async function removeSplit(voucherId: string) {
    await fetch("/api/config/split", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucher_id: voucherId }),
    });
    onSplitChange();
  }

  function startEdit(expense: Expense) {
    const existing = splitMap.get(expense.voucherId);
    setForm({
      months: existing?.months ?? 12,
      start_month: existing?.start_month ?? expense.date.slice(0, 7),
    });
    setEditing(expense.voucherId);
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-left">
          <th className="px-4 py-2 text-gray-500 font-normal">Datum</th>
          <th className="px-4 py-2 text-gray-500 font-normal">Lieferant</th>
          <th className="px-4 py-2 text-gray-500 font-normal">Notiz</th>
          <th className="px-4 py-2 text-gray-500 font-normal text-right">Betrag</th>
          <th className="px-4 py-2 text-gray-500 font-normal"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {expenses.map((e) => {
          const split = splitMap.get(e.voucherId);
          const isEditing = editing === e.voucherId;
          return (
            <>
              <tr key={e.voucherId} className="hover:bg-gray-800/40">
                <td className="px-4 py-2 text-gray-400">{e.date.slice(0, 10)}</td>
                <td className="px-4 py-2 text-gray-300">{e.contactName ?? "—"}</td>
                <td className="px-4 py-2 text-gray-500 truncate max-w-xs">{e.remark ?? "—"}</td>
                <td className="px-4 py-2 text-right text-gray-300">
                  {formatEur(e.amountForCalc ?? e.amount)}
                  {e.amountForCalc != null && e.amountForCalc !== e.amount && (
                    <span className="block text-xs text-gray-500">{formatEur(e.amount)} gesamt</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {split ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        onClick={() => startEdit(e)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        ÷ {split.months} Mo. ab {split.start_month}
                      </button>
                      <button
                        onClick={() => removeSplit(e.voucherId)}
                        className="text-xs text-gray-500 hover:text-red-400"
                        title="Split entfernen"
                      >
                        ×
                      </button>
                    </span>
                  ) : e.amount > 100 ? (
                    <button
                      onClick={() => startEdit(e)}
                      className="text-xs text-gray-500 hover:text-blue-400"
                    >
                      ÷ aufteilen
                    </button>
                  ) : null}
                </td>
              </tr>
              {isEditing && (
                <tr key={`${e.voucherId}-edit`} className="bg-gray-800/60">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-gray-400 text-xs">Auf</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={form.months}
                        onChange={(e) => setForm((f) => ({ ...f, months: Number(e.target.value) }))}
                        className="w-16 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-sm text-white text-center"
                      />
                      <span className="text-gray-400 text-xs">Monate aufteilen, ab</span>
                      <input
                        type="month"
                        value={form.start_month}
                        onChange={(e) => setForm((f) => ({ ...f, start_month: e.target.value }))}
                        className="rounded bg-gray-700 border border-gray-600 px-2 py-1 text-sm text-white"
                      />
                      <span className="text-gray-500 text-xs">
                        = {formatEur(e.amount / form.months)}/Mo.
                      </span>
                      <button
                        onClick={() => saveSplit(e.voucherId)}
                        className="rounded bg-blue-600 hover:bg-blue-500 px-3 py-1 text-xs text-white"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}
