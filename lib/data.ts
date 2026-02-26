import { fetchAllVouchers, fetchVoucherDetails, type VoucherDetail } from "./lexoffice";
import { getCache, setCache, type LexofficeData } from "./cache";
import { categorizeVoucher, type AppConfig } from "./config";

export async function getLexofficeData(): Promise<LexofficeData> {
  const hit = getCache();
  if (hit) return hit;

  // Sequential fetches — rate limiter in lexoffice.ts enforces 700ms between each request
  const incomeVouchers = await fetchAllVouchers(["salesinvoice"], {
    voucherStatus: "paid,open,paidoff",
  });

  const expenseVouchers = await fetchAllVouchers(["purchaseinvoice"], {
    voucherStatus: "open,paid,paidoff",
  });

  const incomeDetailsMap = await fetchVoucherDetails(incomeVouchers.map((v) => v.id));
  const expenseDetailsMap = await fetchVoucherDetails(expenseVouchers.map((v) => v.id));

  const toRecord = (m: Map<string, VoucherDetail>): Record<string, VoucherDetail> =>
    Object.fromEntries(m.entries());

  const data: LexofficeData = {
    incomeVouchers,
    expenseVouchers,
    incomeDetails: toRecord(incomeDetailsMap),
    expenseDetails: toRecord(expenseDetailsMap),
    fetchedAt: Date.now(),
  };

  setCache(data);
  return data;
}

export function buildUncategorized(
  config: AppConfig,
  expenseVouchers: LexofficeData["expenseVouchers"],
  expenseDetails: LexofficeData["expenseDetails"]
) {
  return expenseVouchers
    .map((v) => {
      const detail = expenseDetails[v.id];
      const category = categorizeVoucher(config, v.id, v.contactName, detail?.remark);
      return {
        id: v.id,
        voucherNumber: v.voucherNumber,
        voucherDate: v.voucherDate,
        contactName: v.contactName,
        remark: detail?.remark,
        netAmount: detail?.totalPrice?.totalNetAmount ?? v.totalAmount,
        grossAmount: detail?.totalPrice?.totalGrossAmount ?? v.totalAmount,
        category,
      };
    })
    .filter((v) => v.category === null);
}
