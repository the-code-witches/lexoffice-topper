import type { VoucherListItem, VoucherDetail } from "./lexoffice";

export interface LexofficeData {
  incomeVouchers: VoucherListItem[];
  incomeDetails: Record<string, VoucherDetail>;
  expenseVouchers: VoucherListItem[];
  expenseDetails: Record<string, VoucherDetail>;
  fetchedAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;

// Use globalThis so the cache is shared across all API route module instances
// (Next.js dev mode gives each route its own module scope, but globalThis is process-wide)
declare global {
  // eslint-disable-next-line no-var
  var __lexofficeCache: LexofficeData | undefined;
}

function store(): LexofficeData | null {
  return globalThis.__lexofficeCache ?? null;
}

export function getCache(): LexofficeData | null {
  const cached = store();
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > TTL_MS) {
    globalThis.__lexofficeCache = undefined;
    return null;
  }
  return cached;
}

export function setCache(data: LexofficeData): void {
  globalThis.__lexofficeCache = data;
}

export function clearCache(): void {
  globalThis.__lexofficeCache = undefined;
}

export function getCacheStatus(): { cached: boolean; fetchedAt: number | null; ageMs: number | null } {
  const cached = store();
  if (!cached) return { cached: false, fetchedAt: null, ageMs: null };
  return { cached: true, fetchedAt: cached.fetchedAt, ageMs: Date.now() - cached.fetchedAt };
}
