import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = loadConfig();
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
