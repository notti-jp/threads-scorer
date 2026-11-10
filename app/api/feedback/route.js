import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

// フィードバック取得（ユーザー別）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    const rows = await sql`
      SELECT * FROM feedbacks 
      WHERE username = ${username} 
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// フィードバック保存
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, mainPost, replyPost, views, likes, comments, mode, source, hookLine } = body;

    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();

    // ユーザーが存在しなければ作成
    await sql`
      INSERT INTO users (username) VALUES (${username})
      ON CONFLICT (username) DO NOTHING
    `;

    // フィードバック保存
    // ★タブAの生成から来た投稿は mode / source / hook_line を添えて保存する。
    //   これまで「アプリが作ったどの投稿が伸びたか」を知る手段が無く、何本作っても学べなかった。
    //   列がまだ追加されていないDBでも保存が止まらないよう、失敗したら従来の形で保存する
    let result;
    try {
      result = await sql`
        INSERT INTO feedbacks (username, main_post, reply_post, views, likes, comments, posted_at, mode, source, hook_line)
        VALUES (${username}, ${mainPost || ""}, ${replyPost || ""}, ${views || null}, ${likes || null}, ${comments || null}, NOW(),
                ${mode || null}, ${source || null}, ${hookLine || null})
        RETURNING id
      `;
    } catch (e) {
      console.error(`[feedback] 拡張列での保存に失敗（列が未追加の可能性）: ${e.message}`);
      result = await sql`
        INSERT INTO feedbacks (username, main_post, reply_post, views, likes, comments, posted_at)
        VALUES (${username}, ${mainPost || ""}, ${replyPost || ""}, ${views || null}, ${likes || null}, ${comments || null}, NOW())
        RETURNING id
      `;
    }

    return NextResponse.json({ result: "ok", id: result[0].id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// フィードバック削除
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const username = searchParams.get("username");
    if (!id || !username) return NextResponse.json({ error: "IDとユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    await sql`DELETE FROM feedbacks WHERE id = ${id} AND username = ${username}`;
    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
