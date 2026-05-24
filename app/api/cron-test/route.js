import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const debug = [];
  debug.push("実行時刻: " + new Date().toISOString());

  try {
    const sql = getDb();
    debug.push("DB接続OK");

    // まずscheduled_postsの全件を確認
    const allPosts = await sql`SELECT id, username, status FROM scheduled_posts ORDER BY id`;
    debug.push("全予約データ: " + JSON.stringify(allPosts));

    const pending = await sql`
      SELECT sp.id, sp.main_post, sp.reply_post, sp.username,
             u.threads_access_token, u.threads_user_id
      FROM scheduled_posts sp
      JOIN users u ON sp.username = u.username
      WHERE sp.status = 'pending' AND sp.scheduled_at <= NOW()
      ORDER BY sp.scheduled_at ASC
      LIMIT 10
    `;

    debug.push(`pending件数: ${pending.length}`);

    if (pending.length === 0) {
      return NextResponse.json({ debug, message: "投稿予定なし" }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    }

    const post = pending[0];
    debug.push(`投稿ID: ${post.id}`);
    debug.push(`username: ${post.username}`);
    debug.push(`threads_user_id: ${post.threads_user_id}`);
    debug.push(`token先頭: ${post.threads_access_token?.slice(0, 15)}...`);
    debug.push(`本文先頭: ${post.main_post?.slice(0, 30)}...`);

    if (!post.threads_access_token || !post.threads_user_id) {
      return NextResponse.json({ debug, error: "トークンまたはuser_idが空" }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    }

    const token = post.threads_access_token;
    const userId = post.threads_user_id;

    // Step1: メディアコンテナ作成
    debug.push("Step1: コンテナ作成開始");
    const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "TEXT", text: post.main_post, access_token: token }),
    });
    const createText = await createRes.text();
    debug.push(`Step1レスポンス: status=${createRes.status}, body=${createText.slice(0, 200)}`);

    if (!createRes.ok) {
      await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${createText.slice(0, 500)} WHERE id = ${post.id}`;
      return NextResponse.json({ debug, error: "コンテナ作成失敗" }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    }

    const containerIdMatch = createText.match(/"id"\s*:\s*"(\d+)"/);
    if (!containerIdMatch) {
      debug.push("IDパターン不一致。レスポンス全文: " + createText);
      return NextResponse.json({ debug, error: "コンテナID取得失敗" }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    }
    const containerId = containerIdMatch[1];
    debug.push(`containerId: ${containerId}`);

    // Step2: 公開
    debug.push("Step2: 公開開始");
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const publishText = await publishRes.text();
    debug.push(`Step2レスポンス: status=${publishRes.status}, body=${publishText.slice(0, 200)}`);

    if (!publishRes.ok) {
      await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${publishText.slice(0, 500)} WHERE id = ${post.id}`;
      return NextResponse.json({ debug, error: "公開失敗" }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    }

    const threadIdMatch = publishText.match(/"id"\s*:\s*"(\d+)"/);
    const threadId = threadIdMatch ? threadIdMatch[1] : "unknown";
    debug.push(`threadId: ${threadId}`);

    await sql`UPDATE scheduled_posts SET status = 'posted', threads_post_id = ${threadId} WHERE id = ${post.id}`;
    debug.push("DB更新完了: posted");

    return NextResponse.json({ debug, success: true, threadId }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (e) {
    debug.push(`エラー: ${e.message}`);
    return NextResponse.json({ debug, error: e.message }, { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  }
}
