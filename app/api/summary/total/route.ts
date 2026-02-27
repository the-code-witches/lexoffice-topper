import { NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { getLexofficeData } from "@/lib/data";
import { calcKontostand, calcPersonBudgets, buildCategorizedExpenses } from "@/lib/calculations";

export async function GET() {
  try {
    const config = loadConfig();
    const { incomeVouchers, incomeDetails, expenseVouchers, expenseDetails } =
      await getLexofficeData();

    const incomeDetailsArr = Object.values(incomeDetails);
    const kontostand = calcKontostand(incomeDetailsArr, config.withdrawals);

    const expenseDetailsMap = new Map(Object.entries(expenseDetails));
    const allExpenses = buildCategorizedExpenses(
      expenseVouchers,
      expenseDetailsMap,
      (id, contactName, remark) => categorizeVoucher(config, id, contactName, remark)
    );
    // "tax" category = quarterly VAT payments — they offset taxOwed, not regular expenses
    const taxExpenses = allExpenses.filter((e) => e.category === "tax");
    const categorized = allExpenses.filter(
      (e): e is typeof e & { category: string } => e.category !== null && e.category !== "tax"
    );

    // Vorsteuer: sum of VAT paid on all expense vouchers (deductible from Umsatzsteuer)
    kontostand.inputTax = expenseVouchers.reduce(
      (s, v) => s + (expenseDetails[v.id]?.totalPrice?.totalTaxAmount ?? 0),
      0
    );
    kontostand.taxPaid = taxExpenses.reduce((s, e) => s + e.amount, 0);
    kontostand.totalExpenses = categorized.reduce((s, e) => s + e.amount, 0);

    const allDates = [
      ...incomeVouchers.map((v) => v.voucherDate),
      ...expenseVouchers.map((v) => v.voucherDate),
      ...config.withdrawals.map((w) => w.date),
    ].filter(Boolean);

    const personBudgets = calcPersonBudgets(config, categorized, allDates);
    const internalExpenses = categorized
      .filter((e) => e.category === "internal")
      .reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      kontostand,
      personBudgets,
      internal: {
        name: config.internal.name,
        monthlyBudget: config.internal.monthly_budget,
        totalExpenses: internalExpenses,
      },
      withdrawals: config.withdrawals,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
