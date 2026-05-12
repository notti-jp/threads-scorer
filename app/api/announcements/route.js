import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export async function GET() {
  try {
    const sql = getDb();
    // alertがあればalertを最優先で返す
    const alerts = await sql`SELECT message, type FROM announcements WHERE type = 'alert' ORDER BY created_at DESC LIMIT 1`;
    if (alerts.length > 0) return NextResponse.json({ message: alerts[0].message, type: "alert" });
    // memoはランダムに1件返す
    const memos = await sql`SELECT message, type FROM announcements WHERE type = 'memo' ORDER BY RANDOM() LIMIT 1`;
    if (memos.length > 0) return NextResponse.json({ message: memos[0].message, type: "memo" });
    return NextResponse.json({ message: null, type: null });
  } catch {
    return NextResponse.json({ message: null, type: null });
  }
}
