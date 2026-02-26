import { NextRequest, NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { getLexofficeData } from "@/lib/data";
import {
  calcMonthlyPersonSummaries,
  calcMonthlyInternal,
  buildCategorizedExpenses,
} from "@/lib/calculations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
    }

    const config = loadConfig();
    const { incomeVouchers, incomeDetails, expenseVouchers, expenseDetails } =
      await getLexofficeData();

    const monthIncomeVouchers = incomeVouchers.filter((v) => v.voucherDate.startsWith(month));
    const monthExpenseVouchers = expenseVouchers.filter((v) => v.voucherDate.startsWith(month));

    const netIncome = monthIncomeVouchers.reduce(
      (s, v) => s + (incomeDetails[v.id]?.totalPrice?.totalNetAmount ?? 0),
      0
    );
    const taxAmount = monthIncomeVouchers.reduce(
      (s, v) => s + (incomeDetails[v.id]?.totalPrice?.totalTaxAmount ?? 0),
      0
    );

    const expenseDetailsMap = new Map(Object.entries(expenseDetails));
    const allExpenses = buildCategorizedExpenses(
      monthExpenseVouchers,
      expenseDetailsMap,
      (id, contactName, remark) => categorizeVoucher(config, id, contactName, remark)
    );
    const categorized = allExpenses.filter(
      (e): e is typeof e & { category: string } => e.category !== null
    );

    const personSummaries = calcMonthlyPersonSummaries(config, month, categorized);
    const internalSummary = calcMonthlyInternal(config, month, categorized);
    const monthWithdrawals = config.withdrawals.filter((w) => w.date.startsWith(month));

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
