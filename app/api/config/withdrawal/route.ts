import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, amount, person_id, note } = body as {
      date: string;
      amount: number;
      person_id: string;
      note?: string;
    };

    if (!date || !amount || !person_id) {
      return NextResponse.json(
        { error: "date, amount, and person_id are required" },
        { status: 400 }
      );
    }

    const config = loadConfig();
    config.withdrawals.push({ date, amount, person_id, note });
    saveConfig(config);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const index = Number(searchParams.get("index"));
    const config = loadConfig();
    if (isNaN(index) || index < 0 || index >= config.withdrawals.length) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }
    config.withdrawals.splice(index, 1);
    saveConfig(config);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
