import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

// 下書き一覧取得
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    const rows = await sql`
      SELECT * FROM drafts 
      WHERE username = ${username} 
      ORDER BY updated_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 下書き保存（新規 or 更新）
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, id, title, mainPost, reply, status } = body;
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    const draftId = id || ("d" + Date.now() + Math.random().toString(36).slice(2, 6));
    const now = new Date().toISOString();

    // UPSERT（存在すれば更新、なければ新規作成）
    await sql`
      INSERT INTO drafts (id, username, title, main_post, reply, status, created_at, updated_at)
      VALUES (${draftId}, ${username}, ${title || ""}, ${mainPost || ""}, ${reply || ""}, ${status || "draft"}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        title = ${title || ""},
        main_post = ${mainPost || ""},
        reply = ${reply || ""},
        status = ${status || "draft"},
        updated_at = ${now}
    `;

    return NextResponse.json({ result: "ok", id: draftId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 下書き削除
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const username = searchParams.get("username");
    if (!id || !username) return NextResponse.json({ error: "IDとユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    await sql`DELETE FROM drafts WHERE id = ${id} AND username = ${username}`;
    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
