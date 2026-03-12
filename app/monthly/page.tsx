"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/StatCard";
import { BudgetBar } from "@/components/BudgetBar";
import { WithdrawalForm } from "@/components/WithdrawalForm";
import { ExpenseTable } from "@/components/ExpenseTable";
import { formatEur } from "@/lib/calculations";
import type { PersonConfig, Withdrawal, ExpenseSplit } from "@/lib/config";
import type { MonthlyPersonSummary, MonthlyInternalSummary } from "@/lib/calculations";

interface CategorizedExpense {
  voucherId: string;
  category: string;
  amount: number;
  amountForCalc?: number;
  date: string;
  contactName?: string;
  remark?: string;
}

interface MonthlySummary {
  month: string;
  netIncome: number;
  taxAmount: number;
  inputTax: number;
  taxPaid: number;
  personSummaries: MonthlyPersonSummary[];
  internalSummary: MonthlyInternalSummary;
  withdrawals: Withdrawal[];
  categorizedExpenses: CategorizedExpense[];
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function availableMonths() {
  const months: string[] = [];
  const start = new Date(2025, 0, 1);
  const now = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= now) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months.reverse();
}

export default function MonthlyPage() {
  const [month, setMonth] = useState(currentMonth());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [people, setPeople] = useState<PersonConfig[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError("");
    try {
      const [summary, config] = await Promise.all([
        fetch(`/api/summary/monthly?month=${m}`).then((r) => r.json()),
        fetch("/api/config").then((r) => r.json()),
      ]);
      if (summary.error) throw new Error(summary.error);
      setData(summary);
      setPeople(config.people ?? []);
      setSplits(config.splits ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  const monthLabel = new Date(month + "-15").toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-white">Monatsübersicht</h1>
        <select
          value={month}
          onChange={(e) => { setMonth(e.target.value); setExpandedCategory(null); }}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
        >
          {availableMonths().map((m) => (
            <option key={m} value={m}>
              {new Date(m + "-15").toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-gray-500 animate-pulse">Lade {monthLabel}…</p>}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950 p-5 text-red-300">
          <p className="font-medium mb-1">Fehler</p>
          <p className="text-sm font-mono">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Income this month */}
          <section>
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">
              Einnahmen {monthLabel}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Netto Einnahmen" value={formatEur(data.netIncome)} accent="green" />
              <StatCard
                label="MwSt. Zahllast"
                value={formatEur(data.taxAmount - data.inputTax - data.taxPaid)}
                accent="yellow"
                sub={`${formatEur(data.taxAmount)} USt − ${formatEur(data.inputTax)} VSt${data.taxPaid > 0 ? ` − ${formatEur(data.taxPaid)} gezahlt` : ""}`}
              />
            </div>
          </section>

          {/* Withdrawals this month */}
          <section>
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">
              Entnahmen {monthLabel}
            </h2>
            <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
              {data.personSummaries.map((ps) => (
                <div key={ps.person.id} className="flex items-center justify-between px-5 py-4">
                  <span className="font-medium text-white">{ps.person.name}</span>
                  <span className="text-red-400 font-semibold">{formatEur(ps.withdrawals)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-4 bg-gray-800/40">
                {(() => {
                  const amounts = data.personSummaries.map((ps) => ps.withdrawals);
                  const allEqual = amounts.every((a) => a === amounts[0]);
                  const diff = amounts.length === 2 ? Math.abs(amounts[0] - amounts[1]) : 0;
                  const total = data.withdrawals.reduce((s, w) => s + w.amount, 0);
                  return (
                    <>
                      <span className="text-gray-400 font-medium">
                        {allEqual ? "✓ Ausgeglichen" : `Differenz: ${formatEur(diff)}`}
                      </span>
                      <span className="text-red-400 font-semibold">{formatEur(total)}</span>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4">
              <WithdrawalForm people={people} onSaved={() => load(month)} />
            </div>
          </section>

          {/* Budgets this month — expenses only, withdrawals are separate */}
          <section>
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">
              Budgets {monthLabel}
            </h2>
            <div className="space-y-3">
              {[
                ...data.personSummaries.map((ps) => ({ id: ps.person.id, label: ps.person.name, spent: ps.expenses, budget: ps.budget, sub: `${formatEur(ps.expenses)} Ausgaben von ${formatEur(ps.budget)}` })),
                { id: "internal", label: data.internalSummary.name, spent: data.internalSummary.expenses, budget: data.internalSummary.budget, sub: undefined },
              ].map((entry) => {
                const expenses = data.categorizedExpenses.filter((e) => e.category === entry.id).sort((a, b) => b.date.localeCompare(a.date));
                const isExpanded = expandedCategory === entry.id;
                return (
                  <div key={entry.id}>
                    <BudgetBar
                      label={entry.label}
                      spent={entry.spent}
                      budget={entry.budget}
                      sub={entry.sub}
                      onClick={() => setExpandedCategory(isExpanded ? null : entry.id)}
                      expanded={isExpanded}
                    />
                    {isExpanded && expenses.length > 0 && (
                      <div className="mt-1 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                        <ExpenseTable expenses={expenses} splits={splits} onSplitChange={() => load(month)} />
                      </div>
                    )}
                    {isExpanded && expenses.length === 0 && (
                      <p className="mt-1 px-4 py-3 text-sm text-gray-500">Keine Ausgaben.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
