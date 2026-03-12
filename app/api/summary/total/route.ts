import { NextRequest, NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { getLexofficeData } from "@/lib/data";
import { calcKontostand, calcPersonBudgets, buildCategorizedExpenses, applyExpenseSplits } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : null;

    const config = loadConfig();
    const { incomeVouchers, incomeDetails, expenseVouchers, expenseDetails } =
      await getLexofficeData();

    // Derive available years from all voucher dates
    const allVoucherYears = new Set([
      ...incomeVouchers.map((v) => v.voucherDate.slice(0, 4)),
      ...expenseVouchers.map((v) => v.voucherDate.slice(0, 4)),
    ]);
    const availableYears = Array.from(allVoucherYears).sort();

    // Filter to selected year if provided
    const filteredIncomeVouchers = year
      ? incomeVouchers.filter((v) => v.voucherDate.startsWith(year))
      : incomeVouchers;
    const filteredExpenseVouchers = year
      ? expenseVouchers.filter((v) => v.voucherDate.startsWith(year))
      : expenseVouchers;
    const filteredWithdrawals = year
      ? config.withdrawals.filter((w) => (w.value_date ?? w.date).startsWith(year))
      : config.withdrawals;

    const incomeDetailsArr = filteredIncomeVouchers.map((v) => incomeDetails[v.id]).filter(Boolean);
    const kontostand = calcKontostand(incomeDetailsArr, filteredWithdrawals);

    const expenseDetailsMap = new Map(Object.entries(expenseDetails));
    const allExpenses = buildCategorizedExpenses(
      filteredExpenseVouchers,
      expenseDetailsMap,
      (id, contactName, remark) => categorizeVoucher(config, id, contactName, remark)
    );
    // "tax" category = quarterly VAT payments — they offset taxOwed, not regular expenses
    const taxExpenses = allExpenses.filter((e) => e.category === "tax");
    const categorized = allExpenses.filter(
      (e): e is typeof e & { category: string } => e.category !== null && e.category !== "tax"
    );

    // Vorsteuer: sum of VAT paid on all expense vouchers (deductible from Umsatzsteuer)
    kontostand.inputTax = filteredExpenseVouchers.reduce(
      (s, v) => s + (expenseDetails[v.id]?.totalPrice?.totalTaxAmount ?? 0),
      0
    );
    kontostand.taxPaid = taxExpenses.reduce((s, e) => s + e.amount, 0);
    // Apply splits: spread split expenses across months, cap at current month
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const calcExpenses = applyExpenseSplits(categorized, config.splits)
      .filter((e) => e.date.slice(0, 7) <= currentYearMonth);
    kontostand.totalExpenses = calcExpenses.reduce((s, e) => s + e.amount, 0);

    const allDates = [
      ...filteredIncomeVouchers.map((v) => v.voucherDate),
      ...filteredExpenseVouchers.map((v) => v.voucherDate),
      ...filteredWithdrawals.map((w) => w.date),
    ].filter(Boolean);

    // For year filter, cap months elapsed at Dec of that year (or current month)
    const latestDate = year
      ? year < String(now.getFullYear()) ? `${year}-12` : currentYearMonth
      : undefined;

    const personBudgets = calcPersonBudgets(config, calcExpenses, allDates, latestDate, filteredWithdrawals);
    const internalExpenses = calcExpenses
      .filter((e) => e.category === "internal")
      .reduce((s, e) => s + e.amount, 0);

    // Build display expenses: one entry per voucher with amountForCalc = sum of
    // portions that were included in calcExpenses (respects year filter + current month cap)
    const calcByVoucher = new Map<string, number>();
    for (const e of calcExpenses) {
      calcByVoucher.set(e.voucherId, (calcByVoucher.get(e.voucherId) ?? 0) + e.amount);
    }
    const displayExpenses = categorized
      .map((e) => ({ ...e, amountForCalc: calcByVoucher.get(e.voucherId) ?? e.amount }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      year,
      availableYears,
      kontostand,
      personBudgets,
      internal: {
        name: config.internal.name,
        monthlyBudget: config.internal.monthly_budget,
        totalExpenses: internalExpenses,
      },
      withdrawals: filteredWithdrawals,
      categorizedExpenses: displayExpenses,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
