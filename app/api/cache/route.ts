import { NextResponse } from "next/server";
import { clearCache, getCacheStatus } from "@/lib/cache";

export async function GET() {
  return NextResponse.json(getCacheStatus());
}

export async function DELETE() {
  clearCache();
  return NextResponse.json({ ok: true });
}
