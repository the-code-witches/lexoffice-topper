import type { VoucherListItem, VoucherDetail } from "./lexoffice";

export interface LexofficeData {
  incomeVouchers: VoucherListItem[];
  incomeDetails: Record<string, VoucherDetail>;
  expenseVouchers: VoucherListItem[];
  expenseDetails: Record<string, VoucherDetail>;
  fetchedAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;

let cached: LexofficeData | null = null;

export function getCache(): LexofficeData | null {
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > TTL_MS) {
    cached = null;
    return null;
  }
  return cached;
}

export function setCache(data: LexofficeData): void {
  cached = data;
}

export function clearCache(): void {
  cached = null;
}

export function getCacheStatus(): { cached: boolean; fetchedAt: number | null; ageMs: number | null } {
  if (!cached) return { cached: false, fetchedAt: null, ageMs: null };
  return { cached: true, fetchedAt: cached.fetchedAt, ageMs: Date.now() - cached.fetchedAt };
}
