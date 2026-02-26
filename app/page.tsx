"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/StatCard";
import { BudgetBar } from "@/components/BudgetBar";
import { WithdrawalForm } from "@/components/WithdrawalForm";
import { formatEur } from "@/lib/calculations";
import type { PersonConfig, Withdrawal } from "@/lib/config";
import type { PersonBudgetSummary } from "@/lib/calculations";

interface TotalSummary {
  kontostand: {
    netIncome: number;
    taxOwed: number;
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
}

export default function TotalPage() {
  const [data, setData] = useState<TotalSummary | null>(null);
  const [people, setPeople] = useState<PersonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, config] = await Promise.all([
        fetch("/api/summary/total").then((r) => r.json()),
        fetch("/api/config").then((r) => r.json()),
      ]);
      if (summary.error) throw new Error(summary.error);
      setData(summary);
      setPeople(config.people ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
  const available = kontostand.netIncome - kontostand.totalWithdrawals - kontostand.totalExpenses;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-white">Gesamtübersicht</h1>

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
            label="Umsatzsteuer (geschuldet)"
            value={formatEur(kontostand.taxOwed)}
            accent="yellow"
            sub="Nicht ausgeben!"
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
            <span className="text-gray-400 font-medium">Gesamt</span>
            <span className="text-red-400 font-semibold">{formatEur(kontostand.totalWithdrawals)}</span>
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
                      <td className="px-4 py-3 text-gray-300">{w.date}</td>
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

      {/* Budget overview */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Ausgabenbudgets gesamt</h2>
        <div className="space-y-3">
          {personBudgets.map((pb) => (
            <BudgetBar
              key={pb.person.id}
              label={pb.person.name}
              spent={pb.totalWithdrawals + pb.totalExpenses}
              budget={pb.totalAllocated}
              sub={`${formatEur(pb.person.monthly_budget)}/Monat · ${formatEur(pb.totalWithdrawals)} Entnahmen + ${formatEur(pb.totalExpenses)} Ausgaben`}
            />
          ))}
          <BudgetBar
            label={internal.name}
            spent={internal.totalExpenses}
            budget={internal.monthlyBudget * (personBudgets[0]?.totalAllocated
              ? Math.round(personBudgets[0].totalAllocated / personBudgets[0].monthlyBudget)
              : 1)}
            sub={`${formatEur(internal.monthlyBudget)}/Monat`}
          />
        </div>
      </section>
    </div>
  );
}
