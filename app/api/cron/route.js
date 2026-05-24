import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();

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
    const results = [];

    for (const post of pending) {
      try {
        if (!post.threads_access_token || !post.threads_user_id) {
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = 'Threads未連携です。会員情報からThreadsと連携してください' WHERE id = ${post.id}`;
          results.push({ id: post.id, result: "no_token" });
          continue;
        }

        const token = post.threads_access_token;
        const userId = post.threads_user_id;

        // Step1: メディアコンテナ作成
        const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_type: "TEXT", text: post.main_post, access_token: token }),
        });
        const createText = await createRes.text();
        
        if (!createRes.ok) {
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${createText.slice(0, 500)} WHERE id = ${post.id}`;
          results.push({ id: post.id, result: "create_failed", detail: createText.slice(0, 100) });
          continue;
        }

        // IDを正規表現で正確に取得（精度問題回避）
        const containerIdMatch = createText.match(/"id"\s*:\s*"(\d+)"/);
        if (!containerIdMatch) {
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${"コンテナID取得失敗: " + createText.slice(0, 200)} WHERE id = ${post.id}`;
          results.push({ id: post.id, result: "no_container_id" });
          continue;
        }
        const containerId = containerIdMatch[1];

        // Step2: 公開
        const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: token }),
        });
        const publishText = await publishRes.text();

        if (!publishRes.ok) {
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${publishText.slice(0, 500)} WHERE id = ${post.id}`;
          results.push({ id: post.id, result: "publish_failed", detail: publishText.slice(0, 100) });
          continue;
        }

        const threadIdMatch = publishText.match(/"id"\s*:\s*"(\d+)"/);
        const threadId = threadIdMatch ? threadIdMatch[1] : "unknown";

        // リプライがあれば投稿
        if (post.reply_post?.trim()) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const replyCreateRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ media_type: "TEXT", text: post.reply_post, reply_to_id: threadId, access_token: token }),
            });
            if (replyCreateRes.ok) {
              const replyText = await replyCreateRes.text();
              const replyIdMatch = replyText.match(/"id"\s*:\s*"(\d+)"/);
              if (replyIdMatch) {
                await new Promise(r => setTimeout(r, 2000));
                await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ creation_id: replyIdMatch[1], access_token: token }),
                });
              }
            }
          } catch (replyErr) {
            // リプライ失敗は本投稿の成功に影響させない
          }
        }

        await sql`UPDATE scheduled_posts SET status = 'posted', threads_post_id = ${threadId} WHERE id = ${post.id}`;
        posted++;
        results.push({ id: post.id, result: "posted", threadId });

        if (pending.length > 1) await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        try {
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${e.message?.slice(0, 500) || "不明なエラー"} WHERE id = ${post.id}`;
        } catch {}
        results.push({ id: post.id, result: "error", msg: e.message?.slice(0, 100) });
      }
    }

    return NextResponse.json({ message: `${posted}件投稿完了`, count: posted, results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
