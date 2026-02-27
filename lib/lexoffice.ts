const BASE_URL = "https://api.lexoffice.io/v1";
const MIN_INTERVAL_MS = 700; // ~1.4 req/s, safely under Lexoffice's 2 req/s limit

let lastRequestAt = 0;

function apiKey(): string {
  const key = process.env.LEXOFFICE_API_KEY;
  if (!key) throw new Error("LEXOFFICE_API_KEY is not set in .env.local");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    Accept: "application/json",
  };
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  // Enforce minimum interval between every request
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lexoffice API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface VoucherListItem {
  id: string;
  voucherType: string;
  voucherStatus: string;
  voucherNumber: string;
  voucherDate: string; // ISO date
  contactId?: string;
  contactName?: string;
  totalAmount: number; // gross
  currency: string;
  archived: boolean;
}

export interface VoucherListResponse {
  content: VoucherListItem[];
  first: boolean;
  last: boolean;
  totalPages: number;
  totalElements: number;
  numberOfElements: number;
  size: number;
  number: number;
}

export interface TotalPrice {
  currency: string;
  totalNetAmount: number;
  totalGrossAmount: number;
  totalTaxAmount: number;
}

export interface VoucherDetail {
  id: string;
  voucherType: string;
  voucherStatus: string;
  voucherNumber: string;
  voucherDate: string;
  contactId?: string;
  totalPrice: TotalPrice;
  remark?: string;
}

export interface Contact {
  id: string;
  company?: { name: string };
  person?: { firstName: string; lastName: string };
}

export interface ContactListResponse {
  content: Contact[];
  totalElements: number;
  totalPages: number;
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

/** Fetch all pages of vouchers matching the given types. */
export async function fetchAllVouchers(
  voucherTypes: string[],
  extraParams: Record<string, string> = {}
): Promise<VoucherListItem[]> {
  const results: VoucherListItem[] = [];
  let page = 0;
  let last = false;

  while (!last) {
    const data = await get<VoucherListResponse>("/voucherlist", {
      voucherType: voucherTypes.join(","),
      page: String(page),
      size: "250",
      sort: "voucherDate,DESC",
      ...extraParams,
    });
    results.push(...data.content);
    last = data.last;
    page++;
  }

  return results;
}

/** Fetch detail for a single voucher, routing to the correct endpoint by type. */
export async function fetchVoucherDetail(item: Pick<VoucherListItem, "id" | "voucherType">): Promise<VoucherDetail> {
  // Lexoffice uses /invoices/{id} for type "invoice", /vouchers/{id} for everything else
  const path = item.voucherType === "invoice" ? `/invoices/${item.id}` : `/vouchers/${item.id}`;
  const raw = await get<Record<string, unknown>>(path);

  // /vouchers/{id} returns totalGrossAmount and totalTaxAmount at the root level (no totalPrice wrapper).
  // /invoices/{id} returns the proper totalPrice object. Normalize voucher responses here so the
  // rest of the codebase can always use detail.totalPrice.totalNetAmount uniformly.
  if (!("totalPrice" in raw)) {
    const gross = (raw.totalGrossAmount as number) ?? 0;
    const tax = (raw.totalTaxAmount as number) ?? 0;
    raw.totalPrice = {
      currency: "EUR",
      totalGrossAmount: gross,
      totalTaxAmount: tax,
      totalNetAmount: Math.round((gross - tax) * 100) / 100,
    } satisfies TotalPrice;
  }

  return raw as unknown as VoucherDetail;
}

/** Fetch details for many vouchers sequentially, routing each by its type. */
export async function fetchVoucherDetails(
  items: Pick<VoucherListItem, "id" | "voucherType">[]
): Promise<Map<string, VoucherDetail>> {
  const result = new Map<string, VoucherDetail>();
  for (const item of items) {
    result.set(item.id, await fetchVoucherDetail(item));
  }
  return result;
}

/** Fetch contacts, optionally filtering by name. */
export async function fetchContacts(name?: string): Promise<Contact[]> {
  const params: Record<string, string> = { size: "250", page: "0" };
  if (name) params.name = name;
  const data = await get<ContactListResponse>("/contacts", params);
  return data.content;
}
