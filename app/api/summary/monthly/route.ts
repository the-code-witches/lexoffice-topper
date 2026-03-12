import { NextRequest, NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { getLexofficeData } from "@/lib/data";
import {
  calcMonthlyPersonSummaries,
  calcMonthlyInternal,
  buildCategorizedExpenses,
  applyExpenseSplits,
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

    // Build from ALL vouchers so splits from other months appear in this month
    const allExpenses = buildCategorizedExpenses(
      expenseVouchers,
      expenseDetailsMap,
      (id, contactName, remark) => categorizeVoucher(config, id, contactName, remark)
    );
    const taxPaid = allExpenses
      .filter((e) => e.category === "tax" && e.date.startsWith(month))
      .reduce((s, e) => s + e.amount, 0);
    const allCategorized = allExpenses.filter(
      (e): e is typeof e & { category: string } => e.category !== null && e.category !== "tax"
    );

    // Vorsteuer: VAT paid on expenses this month (deductible from Umsatzsteuer)
    const inputTax = monthExpenseVouchers.reduce(
      (s, v) => s + (expenseDetails[v.id]?.totalPrice?.totalTaxAmount ?? 0),
      0
    );

    // Apply splits across all time, then filter to this month for calculations
    const calcExpenses = applyExpenseSplits(allCategorized, config.splits)
      .filter((e) => e.date.startsWith(month));
    const personSummaries = calcMonthlyPersonSummaries(config, month, calcExpenses);
    const internalSummary = calcMonthlyInternal(config, month, calcExpenses);
    const monthWithdrawals = config.withdrawals.filter((w) => w.date.startsWith(month));

    // Build display expenses: one entry per voucher active this month,
    // with amountForCalc = portion used (differs from amount only for splits)
    const splitMap = new Map(config.splits.map((s) => [s.voucher_id, s]));
    const displayExpenses = allCategorized
      .filter((e) => {
        const split = splitMap.get(e.voucherId);
        if (!split) return e.date.startsWith(month);
        const [y, m2] = split.start_month.split("-").map(Number);
        const endDate = new Date(y, m2 - 1 + split.months - 1, 1);
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
        return month >= split.start_month && month <= endMonth;
      })
      .map((e) => {
        const split = splitMap.get(e.voucherId);
        return { ...e, amountForCalc: split ? e.amount / split.months : e.amount };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      month,
      netIncome,
      taxAmount,
      inputTax,
      taxPaid,
      personSummaries,
      internalSummary,
      withdrawals: monthWithdrawals,
      categorizedExpenses: displayExpenses,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
