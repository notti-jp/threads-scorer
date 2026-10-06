import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
  try {
    const sql = getDb();
    // alertがあればalertを最優先で返す
    const alerts = await sql`SELECT message, type FROM announcements WHERE type = 'alert' ORDER BY created_at DESC LIMIT 1`;
    if (alerts.length > 0) return NextResponse.json({ message: alerts[0].message, type: "alert" }, { headers });
    // memoはランダムに1件返す
    const memos = await sql`SELECT message, type FROM announcements WHERE type = 'memo' ORDER BY RANDOM() LIMIT 1`;
    if (memos.length > 0) return NextResponse.json({ message: memos[0].message, type: "memo" }, { headers });
    return NextResponse.json({ message: null, type: null }, { headers });
  } catch {
    return NextResponse.json({ message: null, type: null }, { headers });
  }
}
