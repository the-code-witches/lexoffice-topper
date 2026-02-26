import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/config";
import { getCache } from "@/lib/cache";
import { buildUncategorized } from "@/lib/calculations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { voucherId, category, note, asRule, ruleMatch } = body as {
      voucherId: string;
      category: string;
      note?: string;
      asRule?: boolean;
      ruleMatch?: string;
    };

    if (!voucherId || !category) {
      return NextResponse.json({ error: "voucherId and category are required" }, { status: 400 });
    }

    const config = loadConfig();

    if (asRule && ruleMatch) {
      const existing = config.rules.findIndex(
        (r) => r.match.toLowerCase() === ruleMatch.toLowerCase()
      );
      if (existing >= 0) {
        config.rules[existing] = { match: ruleMatch, category, note };
      } else {
        config.rules.push({ match: ruleMatch, category, note });
      }
    } else {
      const existing = config.vouchers.findIndex((v) => v.id === voucherId);
      if (existing >= 0) {
        config.vouchers[existing] = { id: voucherId, category, note };
      } else {
        config.vouchers.push({ id: voucherId, category, note });
      }
    }

    saveConfig(config);

    // Return updated uncategorized list from cache — no Lexoffice re-fetch needed
    const cached = getCache();
    if (cached) {
      const uncategorized = buildUncategorized(
        config,
        cached.expenseVouchers,
        cached.expenseDetails
      );
      return NextResponse.json({ ok: true, uncategorized });
    }

    return NextResponse.json({ ok: true, uncategorized: null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
