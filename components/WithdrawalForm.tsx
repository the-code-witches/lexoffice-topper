"use client";

import { useState } from "react";
import type { PersonConfig } from "@/lib/config";

export function WithdrawalForm({
  people,
  onSaved,
}: {
  people: PersonConfig[];
  onSaved: () => void;
}) {
  function lastDayOfPrevMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
  }

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [valueDate, setValueDate] = useState(lastDayOfPrevMonth());
  const [amount, setAmount] = useState("");
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/config/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, value_date: valueDate !== date ? valueDate : undefined, amount: parseFloat(amount), person_id: personId, note }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Fehler beim Speichern");
      }
      setOpen(false);
      setAmount("");
      setNote("");
      setValueDate(lastDayOfPrevMonth());
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-gray-700 px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
      >
        + Entnahme erfassen
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4">
      <p className="font-medium text-white">Neue Entnahme</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Überweisungsdatum</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Gilt für (Wertdatum)</label>
          <input
            type="date"
            value={valueDate}
            onChange={(e) => setValueDate(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Betrag (€)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Person</label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notiz (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z.B. Gehalt Februar"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || !amount || !date}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
