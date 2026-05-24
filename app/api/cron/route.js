import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // Vercel Cron認証（不正アクセス防止）
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: "THREADS_ACCESS_TOKEN未設定" }, { status: 500 });

  try {
    const sql = getDb();

    // 現在時刻以前で未投稿のものを取得
    const pending = await sql`
      SELECT id, main_post, reply_post FROM scheduled_posts
      WHERE status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 5
    `;

    if (pending.length === 0) {
      return NextResponse.json({ message: "投稿予定なし", count: 0 });
    }

    // ユーザーIDを取得
    const meRes = await fetch(`https://graph.threads.net/v1.0/me?access_token=${accessToken}`);
    if (!meRes.ok) throw new Error("ユーザー情報取得失敗");
    const { id: userId } = await meRes.json();

    let posted = 0;

    for (const post of pending) {
      try {
        // 本投稿を作成・公開
        const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_type: "TEXT", text: post.main_post, access_token: accessToken }),
        });
        if (!createRes.ok) throw new Error(`作成失敗: ${createRes.status}`);
        const { id: containerId } = await createRes.json();

        const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
        });
        if (!publishRes.ok) throw new Error(`公開失敗: ${publishRes.status}`);
        const { id: threadId } = await publishRes.json();

        // リプライがあれば投稿
        if (post.reply_post?.trim()) {
          await new Promise(r => setTimeout(r, 3000));
          const replyCreate = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_type: "TEXT", text: post.reply_post, reply_to_id: threadId, access_token: accessToken }),
          });
          if (replyCreate.ok) {
            const { id: replyContainerId } = await replyCreate.json();
            await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: replyContainerId, access_token: accessToken }),
            });
          }
        }

        // 成功
        await sql`UPDATE scheduled_posts SET status = 'posted', threads_post_id = ${threadId} WHERE id = ${post.id}`;
        posted++;

        // 連続投稿の間隔を空ける
        if (pending.length > 1) await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        // 失敗
        await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${e.message} WHERE id = ${post.id}`;
      }
    }

    return NextResponse.json({ message: `${posted}件投稿完了`, count: posted });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
