import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { getLexofficeData, buildUncategorized } from "@/lib/data";

export async function GET() {
  try {
    const config = loadConfig();
    const { expenseVouchers, expenseDetails } = await getLexofficeData();
    const uncategorized = buildUncategorized(config, expenseVouchers, expenseDetails);
    return NextResponse.json({ uncategorized, config });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
