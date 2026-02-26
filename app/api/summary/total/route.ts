import { NextResponse } from "next/server";
import { loadConfig, categorizeVoucher } from "@/lib/config";
import { fetchAllVouchers, fetchVoucherDetails } from "@/lib/lexoffice";
import {
  calcKontostand,
  calcPersonBudgets,
  buildCategorizedExpenses,
} from "@/lib/calculations";

export async function GET() {
  try {
    const config = loadConfig();

    // Fetch income (sales invoices)
    const incomeVouchers = await fetchAllVouchers(["salesinvoice"], {
      voucherStatus: "paid,open,paidoff",
    });

    // Fetch expenses (purchase invoices)
    const expenseVouchers = await fetchAllVouchers(["purchaseinvoice"], {
      voucherStatus: "open,paid,paidoff",
    });

    // Fetch all details rate-limited (income + expense in sequence to stay under 2 req/s)
    const incomeDetailsMap = await fetchVoucherDetails(incomeVouchers.map((v) => v.id));
    const expenseDetailsMap = await fetchVoucherDetails(expenseVouchers.map((v) => v.id));

    const incomeDetails = Array.from(incomeDetailsMap.values());
    const kontostand = calcKontostand(incomeDetails, config.withdrawals);

    const allExpenses = buildCategorizedExpenses(
      expenseVouchers,
      expenseDetailsMap,
      (id, contactName, remark) =>
        categorizeVoucher(config, id, contactName, remark)
    );
    const categorized = allExpenses.filter(
      (e): e is typeof e & { category: string } => e.category !== null
    );

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
