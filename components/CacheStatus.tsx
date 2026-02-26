"use client";

import { useEffect, useState } from "react";

interface Status {
  cached: boolean;
  fetchedAt: number | null;
  ageMs: number | null;
}

export function CacheStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadStatus() {
    const res = await fetch("/api/cache");
    const data = await res.json();
    setStatus(data);
  }

  useEffect(() => { loadStatus(); }, []);

  async function refresh() {
    setRefreshing(true);
    await fetch("/api/cache", { method: "DELETE" });
    setStatus({ cached: false, fetchedAt: null, ageMs: null });
    setRefreshing(false);
    // Reload current page data
    window.location.reload();
  }

  if (!status) return null;

  const label = status.cached && status.fetchedAt
    ? `Daten von ${new Date(status.fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
    : "Nicht geladen";

  return (
    <div className="flex items-center gap-3 ml-auto">
      <span className="text-xs text-gray-600">{label}</span>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-50"
        title="Daten von Lexoffice neu laden"
      >
        {refreshing ? "Lädt…" : "↺ Neu laden"}
      </button>
    </div>
  );
}
