import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { getLexofficeData } from "@/lib/data";
import { buildUncategorized } from "@/lib/calculations";

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
