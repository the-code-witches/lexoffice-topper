import { NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { fetchAllVouchers, fetchVoucherDetails } from "@/lib/lexoffice";

export async function GET() {
  try {
    const config = loadConfig();
    const expenseVouchers = await fetchAllVouchers(["purchaseinvoice"], {
      voucherStatus: "open,paid,paidoff",
    });

    const detailsMap = await fetchVoucherDetails(expenseVouchers.map((v) => v.id));

    const uncategorized = expenseVouchers
      .map((v) => {
        const detail = detailsMap.get(v.id);
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

    return NextResponse.json({ uncategorized, config });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
