import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // Vercel Cron認証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();

    // 現在時刻以前で未投稿のものを、ユーザーのトークンと一緒に取得
    const pending = await sql`
      SELECT sp.id, sp.main_post, sp.reply_post, sp.username,
             u.threads_access_token, u.threads_user_id
      FROM scheduled_posts sp
      JOIN users u ON sp.username = u.username
      WHERE sp.status = 'pending' AND sp.scheduled_at <= NOW()
      ORDER BY sp.scheduled_at ASC
      LIMIT 10
    `;

    if (pending.length === 0) {
      return NextResponse.json({ message: "投稿予定なし", count: 0 });
    }

    let posted = 0;

    for (const post of pending) {
      try {
        if (!post.threads_access_token || !post.threads_user_id) {
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = 'Threads未連携です。会員情報からThreadsと連携してください' WHERE id = ${post.id}`;
          continue;
        }

        const token = post.threads_access_token;
        const userId = post.threads_user_id;

        // 本投稿を作成・公開
        const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_type: "TEXT", text: post.main_post, access_token: token }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error?.message || `作成失敗: ${createRes.status}`);
        }
        const { id: containerId } = await createRes.json();

        const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: token }),
        });
        if (!publishRes.ok) {
          const err = await publishRes.json();
          throw new Error(err.error?.message || `公開失敗: ${publishRes.status}`);
        }
        const { id: threadId } = await publishRes.json();

        // リプライがあれば投稿
        if (post.reply_post?.trim()) {
          await new Promise(r => setTimeout(r, 3000));
          const replyCreate = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_type: "TEXT", text: post.reply_post, reply_to_id: threadId, access_token: token }),
          });
          if (replyCreate.ok) {
            const { id: replyContainerId } = await replyCreate.json();
            await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: replyContainerId, access_token: token }),
            });
          }
        }

        await sql`UPDATE scheduled_posts SET status = 'posted', threads_post_id = ${threadId} WHERE id = ${post.id}`;
        posted++;

        if (pending.length > 1) await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${e.message} WHERE id = ${post.id}`;
      }
    }

    return NextResponse.json({ message: `${posted}件投稿完了`, count: posted });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
