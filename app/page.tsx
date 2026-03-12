"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/StatCard";
import { BudgetBar } from "@/components/BudgetBar";
import { WithdrawalForm } from "@/components/WithdrawalForm";
import { ExpenseTable } from "@/components/ExpenseTable";
import { formatEur } from "@/lib/calculations";
import type { PersonConfig, Withdrawal, ExpenseSplit } from "@/lib/config";
import type { PersonBudgetSummary } from "@/lib/calculations";

interface CategorizedExpense {
  voucherId: string;
  category: string;
  amount: number;
  amountForCalc?: number;
  date: string;
  contactName?: string;
  remark?: string;
}

interface TotalSummary {
  year: string | null;
  availableYears: string[];
  kontostand: {
    netIncome: number;
    taxOwed: number;
    inputTax: number;
    taxPaid: number;
    totalWithdrawals: number;
    totalExpenses: number;
  };
  personBudgets: PersonBudgetSummary[];
  internal: {
    name: string;
    monthlyBudget: number;
    totalExpenses: number;
  };
  withdrawals: Withdrawal[];
  categorizedExpenses: CategorizedExpense[];
}

export default function TotalPage() {
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [data, setData] = useState<TotalSummary | null>(null);
  const [people, setPeople] = useState<PersonConfig[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (year?: string) => {
    setLoading(true);
    setError("");
    try {
      const url = year ? `/api/summary/total?year=${year}` : "/api/summary/total";
      const [summary, config] = await Promise.all([
        fetch(url).then((r) => r.json()),
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

  useEffect(() => { load(selectedYear || undefined); }, [load, selectedYear]);

  if (loading) {
    return <p className="text-gray-500 animate-pulse">Lade Daten von Lexoffice…</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950 p-5 text-red-300">
        <p className="font-medium mb-1">Fehler</p>
        <p className="text-sm font-mono">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const { kontostand, personBudgets, internal, withdrawals } = data;
  // Zahllast = Umsatzsteuer − Vorsteuer − bereits gezahlte Vorauszahlungen
  const taxOwedRemaining = kontostand.taxOwed - kontostand.inputTax - kontostand.taxPaid;
  const available = kontostand.netIncome - kontostand.totalWithdrawals - kontostand.totalExpenses;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-white">Gesamtübersicht</h1>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
        >
          <option value="">Alle Jahre</option>
          {(data?.availableYears ?? []).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Kontostand */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Kontostand aufgesplittet</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Netto Projekteinkommen"
            value={formatEur(kontostand.netIncome)}
            accent="green"
          />
          <StatCard
            label="MwSt. noch ausstehend"
            value={formatEur(taxOwedRemaining)}
            accent="yellow"
            sub={`${formatEur(kontostand.taxOwed)} USt − ${formatEur(kontostand.inputTax)} VSt${kontostand.taxPaid > 0 ? ` − ${formatEur(kontostand.taxPaid)} gezahlt` : ""}`}
          />
          <StatCard
            label="Gesamt Entnahmen"
            value={formatEur(kontostand.totalWithdrawals)}
            accent="red"
          />
          <StatCard
            label="Verfügbar (netto)"
            value={formatEur(available)}
            accent={available >= 0 ? "blue" : "red"}
            sub="Netto − Entnahmen − Ausgaben"
          />
        </div>
      </section>

      {/* Entnahmen per person */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Entnahmen gesamt</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
          {personBudgets.map((pb) => (
            <div key={pb.person.id} className="flex items-center justify-between px-5 py-4">
              <span className="font-medium text-white">{pb.person.name}</span>
              <span className="text-red-400 font-semibold">{formatEur(pb.totalWithdrawals)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-4 bg-gray-800/40">
            {(() => {
              const amounts = personBudgets.map((pb) => pb.totalWithdrawals);
              const allEqual = amounts.every((a) => a === amounts[0]);
              const diff = amounts.length === 2 ? Math.abs(amounts[0] - amounts[1]) : 0;
              return (
                <>
                  <span className="text-gray-400 font-medium">
                    {allEqual ? "✓ Ausgeglichen" : `Differenz: ${formatEur(diff)}`}
                  </span>
                  <span className="text-red-400 font-semibold">{formatEur(kontostand.totalWithdrawals)}</span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="mt-4">
          <WithdrawalForm people={people} onSaved={load} />
        </div>

        {/* Withdrawal history */}
        {withdrawals.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-500 font-normal">Datum</th>
                  <th className="px-4 py-3 text-gray-500 font-normal">Person</th>
                  <th className="px-4 py-3 text-gray-500 font-normal">Notiz</th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {withdrawals.map((w, i) => {
                  const person = people.find((p) => p.id === w.person_id);
                  return (
                    <tr key={i} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 text-gray-300">
                        {w.date}
                        {w.value_date && w.value_date !== w.date && (
                          <span className="block text-xs text-gray-500">für {w.value_date.slice(0, 7)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{person?.name ?? w.person_id}</td>
                      <td className="px-4 py-3 text-gray-500">{w.note ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-red-400">{formatEur(w.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Budget overview — expenses only, withdrawals are separate */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Ausgabenbudgets gesamt</h2>
        <div className="space-y-3">
          {[
            ...personBudgets.map((pb) => ({ id: pb.person.id, label: pb.person.name, spent: pb.totalExpenses, budget: pb.totalAllocated, sub: `${formatEur(pb.person.monthly_budget)}/Monat · ${formatEur(pb.totalExpenses)} Ausgaben` })),
            { id: "internal", label: internal.name, spent: internal.totalExpenses, budget: internal.monthlyBudget * (personBudgets[0]?.totalAllocated ? Math.round(personBudgets[0].totalAllocated / personBudgets[0].monthlyBudget) : 1), sub: `${formatEur(internal.monthlyBudget)}/Monat` },
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
                    <ExpenseTable expenses={expenses} splits={splits} onSplitChange={() => load(selectedYear || undefined)} />
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
    </div>
  );
}
