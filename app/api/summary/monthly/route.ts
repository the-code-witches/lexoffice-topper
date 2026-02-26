import { NextRequest, NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { fetchAllVouchers, fetchVoucherDetails } from "@/lib/lexoffice";
import {
  calcMonthlyPersonSummaries,
  calcMonthlyInternal,
  buildCategorizedExpenses,
} from "@/lib/calculations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // "YYYY-MM"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
    }

    const dateFrom = `${month}-01`;
    const lastDay = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    ).getDate();
    const dateTo = `${month}-${String(lastDay).padStart(2, "0")}`;

    const config = loadConfig();

    const incomeVouchers = await fetchAllVouchers(["salesinvoice"], {
      voucherStatus: "paid,open,paidoff",
      dateFrom,
      dateTo,
    });

    const expenseVouchers = await fetchAllVouchers(["purchaseinvoice"], {
      voucherStatus: "open,paid,paidoff",
      dateFrom,
      dateTo,
    });

    const incomeDetailsMap = await fetchVoucherDetails(incomeVouchers.map((v) => v.id));
    const expenseDetailsMap = await fetchVoucherDetails(expenseVouchers.map((v) => v.id));

    const incomeDetails = Array.from(incomeDetailsMap.values());
    const netIncome = incomeDetails.reduce(
      (s, v) => s + (v.totalPrice?.totalNetAmount ?? 0),
      0
    );
    const taxAmount = incomeDetails.reduce(
      (s, v) => s + (v.totalPrice?.totalTaxAmount ?? 0),
      0
    );

    const allExpenses = buildCategorizedExpenses(
      expenseVouchers,
      expenseDetailsMap,
      (id, contactName, remark) =>
        categorizeVoucher(config, id, contactName, remark)
    );
    const categorized = allExpenses.filter(
      (e): e is typeof e & { category: string } => e.category !== null
    );

    const personSummaries = calcMonthlyPersonSummaries(config, month, categorized);
    const internalSummary = calcMonthlyInternal(config, month, categorized);

    const monthWithdrawals = config.withdrawals.filter((w) =>
      w.date.startsWith(month)
    );

    return NextResponse.json({
      month,
      netIncome,
      taxAmount,
      personSummaries,
      internalSummary,
      withdrawals: monthWithdrawals,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
