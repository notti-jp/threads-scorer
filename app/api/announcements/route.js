import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT message, type FROM announcements ORDER BY created_at DESC LIMIT 1`;
    return NextResponse.json(rows.length > 0 ? { message: rows[0].message, type: rows[0].type || "memo" } : { message: null, type: null });
  } catch {
    return NextResponse.json({ message: null, type: null });
  }
}
