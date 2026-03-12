import type { AppConfig, PersonConfig, Withdrawal, ExpenseSplit } from "./config";
import type { VoucherDetail, VoucherListItem } from "./lexoffice";

export interface PersonBudgetSummary {
  person: PersonConfig;
  monthlyBudget: number;
  /** Total budget allocated since tracking began (months elapsed × monthly budget) */
  totalAllocated: number;
  /** Total withdrawals recorded */
  totalWithdrawals: number;
  /** Total expenses categorized to this person */
  totalExpenses: number;
  /** How much budget is left = allocated - expenses (withdrawals are tracked separately) */
  totalRemaining: number;
}

export interface MonthlyPersonSummary {
  person: PersonConfig;
  budget: number;
  withdrawals: number;
  expenses: number;
  /** Remaining budget = budget - expenses (withdrawals are tracked separately) */
  remaining: number;
}

export interface MonthlyInternalSummary {
  name: string;
  budget: number;
  expenses: number;
  remaining: number;
}

export interface KontostandBreakdown {
  /** Sum of totalNetAmount across all income vouchers */
  netIncome: number;
  /** Sum of totalTaxAmount across all income vouchers (Umsatzsteuer) */
  taxOwed: number;
  /** Sum of totalTaxAmount across all expense vouchers (Vorsteuer — reduces taxOwed) */
  inputTax: number;
  /** Sum of quarterly VAT payments already made (category "tax") — reduces taxOwed */
  taxPaid: number;
  /** Sum of all recorded withdrawals */
  totalWithdrawals: number;
  /** Sum of all regular expenses (purchase invoices, excl. tax payments) */
  totalExpenses: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isoMonth(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

/** Returns an array of "YYYY-MM" strings from the earliest to latest date (defaults to now). */
export function monthsElapsed(earliestDate: string, latestDate?: string): string[] {
  const start = new Date(earliestDate + "-01");
  const end = latestDate ? new Date(latestDate + "-01") : new Date();
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// ── Core calculations ─────────────────────────────────────────────────────────

export function calcKontostand(
  incomeDetails: VoucherDetail[],
  withdrawals: Withdrawal[]
): KontostandBreakdown {
  const netIncome = incomeDetails.reduce(
    (s, v) => s + (v.totalPrice?.totalNetAmount ?? 0),
    0
  );
  const taxOwed = incomeDetails.reduce(
    (s, v) => s + (v.totalPrice?.totalTaxAmount ?? 0),
    0
  );
  const totalWithdrawals = withdrawals.reduce((s, w) => s + w.amount, 0);
  // inputTax, totalExpenses and taxPaid are filled in by the caller (need expense data)
  return { netIncome, taxOwed, inputTax: 0, taxPaid: 0, totalWithdrawals, totalExpenses: 0 };
}

export function calcPersonBudgets(
  config: AppConfig,
  categorizedExpenses: { voucherId: string; category: string; amount: number; date: string }[],
  allDates: string[], // all relevant dates to determine months elapsed
  latestDate?: string, // optional upper bound for months elapsed (e.g. for year filter)
  withdrawals?: Withdrawal[] // optional pre-filtered withdrawals (defaults to config.withdrawals)
): PersonBudgetSummary[] {
  const effectiveWithdrawals = withdrawals ?? config.withdrawals;
  if (allDates.length === 0) {
    return config.people.map((p) => ({
      person: p,
      monthlyBudget: p.monthly_budget,
      totalAllocated: 0,
      totalWithdrawals: 0,
      totalExpenses: 0,
      totalRemaining: 0,
    }));
  }

  const earliest = allDates.slice().sort()[0].slice(0, 7); // "YYYY-MM"
  const months = monthsElapsed(earliest, latestDate);
  const numMonths = months.length;

  return config.people.map((person) => {
    const totalAllocated = person.monthly_budget * numMonths;
    const totalWithdrawals = effectiveWithdrawals
      .filter((w) => w.person_id === person.id)
      .reduce((s, w) => s + w.amount, 0);
    const totalExpenses = categorizedExpenses
      .filter((e) => e.category === person.id)
      .reduce((s, e) => s + e.amount, 0);
    return {
      person,
      monthlyBudget: person.monthly_budget,
      totalAllocated,
      totalWithdrawals,
      totalExpenses,
      totalRemaining: totalAllocated - totalExpenses,
    };
  });
}

export function calcMonthlyPersonSummaries(
  config: AppConfig,
  month: string, // "YYYY-MM"
  categorizedExpenses: { voucherId: string; category: string; amount: number; date: string }[]
): MonthlyPersonSummary[] {
  return config.people.map((person) => {
    const withdrawals = config.withdrawals
      .filter((w) => w.person_id === person.id && w.date.startsWith(month))
      .reduce((s, w) => s + w.amount, 0);
    const expenses = categorizedExpenses
      .filter((e) => e.category === person.id && e.date.startsWith(month))
      .reduce((s, e) => s + e.amount, 0);
    return {
      person,
      budget: person.monthly_budget,
      withdrawals,
      expenses,
      remaining: person.monthly_budget - expenses,
    };
  });
}

export function calcMonthlyInternal(
  config: AppConfig,
  month: string,
  categorizedExpenses: { voucherId: string; category: string; amount: number; date: string }[]
): MonthlyInternalSummary {
  const expenses = categorizedExpenses
    .filter((e) => e.category === "internal" && e.date.startsWith(month))
    .reduce((s, e) => s + e.amount, 0);
  return {
    name: config.internal.name,
    budget: config.internal.monthly_budget,
    expenses,
    remaining: config.internal.monthly_budget - expenses,
  };
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Spreads split expenses across months. Each split voucher generates N entries
 * with amount/N each, dated to the 1st of each month in the split range.
 * Non-split expenses are returned unchanged.
 */
export function applyExpenseSplits(
  expenses: { voucherId: string; category: string; amount: number; date: string; contactName?: string; remark?: string }[],
  splits: ExpenseSplit[]
): { voucherId: string; category: string; amount: number; date: string; contactName?: string; remark?: string }[] {
  const splitMap = new Map(splits.map((s) => [s.voucher_id, s]));
  const result: typeof expenses = [];

  for (const expense of expenses) {
    const split = splitMap.get(expense.voucherId);
    if (!split) {
      result.push(expense);
      continue;
    }
    const monthlyAmount = expense.amount / split.months;
    const [y, m] = split.start_month.split("-").map(Number);
    for (let i = 0; i < split.months; i++) {
      const d = new Date(y, m - 1 + i, 1);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      result.push({ ...expense, amount: monthlyAmount, date: dateStr });
    }
  }

  return result;
}

/** Build the flat categorized expense list from voucher list + details + config. */
export function buildCategorizedExpenses(
  vouchers: VoucherListItem[],
  details: Map<string, VoucherDetail>,
  categorize: (id: string, contactName?: string, remark?: string) => string | null
): { voucherId: string; category: string | null; amount: number; date: string; contactName?: string; remark?: string }[] {
  return vouchers.map((v) => {
    const detail = details.get(v.id);
    const amount = detail?.totalPrice?.totalNetAmount ?? v.totalAmount;
    const category = categorize(v.id, v.contactName, detail?.remark);
    return {
      voucherId: v.id,
      category,
      amount,
      date: v.voucherDate,
      contactName: v.contactName,
      remark: detail?.remark,
    };
  });
}
