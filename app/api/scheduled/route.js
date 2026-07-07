import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

// GET: 予約投稿一覧を取得
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

  try {
    const sql = getDb();
    const posts = await sql`
      SELECT id, main_post, reply_post, scheduled_at, status, threads_post_id, error_message, created_at
      FROM scheduled_posts WHERE username = ${username}
      ORDER BY scheduled_at ASC
    `;
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 予約投稿を登録
export async function POST(request) {
  try {
    const { username, mainPost, replyPost, scheduledAt } = await request.json();
    if (!username || !mainPost?.trim() || !scheduledAt) {
      return NextResponse.json({ error: "投稿文と予約日時が必要です" }, { status: 400 });
    }

    const sql = getDb();

    // トークンの状態をチェック
    const userRows = await sql`SELECT threads_access_token, threads_token_expires_at FROM users WHERE username = ${username}`;
    const user = userRows[0];
    if (!user?.threads_access_token) {
      return NextResponse.json({ error: "Threadsと連携されていません。会員情報ページから「Threadsと連携する」を押してください" }, { status: 400 });
    }
    if (user.threads_token_expires_at && new Date(user.threads_token_expires_at) <= new Date()) {
      return NextResponse.json({ error: "Threadsとの連携が切れています。会員情報ページから「再連携する」を押して、もう一度連携してください" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO scheduled_posts (username, main_post, reply_post, scheduled_at)
      VALUES (${username}, ${mainPost.trim()}, ${replyPost?.trim() || null}, ${scheduledAt})
      RETURNING id, scheduled_at, status
    `;
    return NextResponse.json({ result: result[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 予約投稿を削除
export async function DELETE(request) {
  try {
    const { id, username } = await request.json();
    if (!id || !username) return NextResponse.json({ error: "IDが必要です" }, { status: 400 });

    const sql = getDb();
    await sql`DELETE FROM scheduled_posts WHERE id = ${id} AND username = ${username} AND status = 'pending'`;
    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: 予約投稿を編集
export async function PUT(request) {
  try {
    const { id, username, mainPost, replyPost, scheduledAt } = await request.json();
    if (!id || !username || !mainPost?.trim() || !scheduledAt) {
      return NextResponse.json({ error: "投稿文と予約日時が必要です" }, { status: 400 });
    }

    const sql = getDb();
    const result = await sql`
      UPDATE scheduled_posts
      SET main_post = ${mainPost.trim()}, reply_post = ${replyPost?.trim() || null}, scheduled_at = ${scheduledAt}
      WHERE id = ${id} AND username = ${username} AND status = 'pending'
      RETURNING id, scheduled_at, status
    `;
    if (result.length === 0) return NextResponse.json({ error: "予約が見つからないか、既に投稿済みです" }, { status: 400 });
    return NextResponse.json({ result: result[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
