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

    // ===== トークン自動更新：期限が7日以内に迫ったトークンをリフレッシュ =====
    try {
      const expiringSoon = await sql`
        SELECT username, threads_access_token
        FROM users
        WHERE threads_access_token IS NOT NULL
          AND threads_token_expires_at IS NOT NULL
          AND threads_token_expires_at <= NOW() + INTERVAL '7 days'
          AND threads_token_expires_at > NOW()
      `;
      for (const u of expiringSoon) {
        try {
          const refreshRes = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${u.threads_access_token}`);
          if (refreshRes.ok) {
            const refreshText = await refreshRes.text();
            const tokenMatch = refreshText.match(/"access_token"\s*:\s*"([^"]+)"/);
            const expiresMatch = refreshText.match(/"expires_in"\s*:\s*(\d+)/);
            if (tokenMatch) {
              const newToken = tokenMatch[1];
              const expiresIn = expiresMatch ? parseInt(expiresMatch[1]) : 5184000;
              const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
              await sql`UPDATE users SET threads_access_token = ${newToken}, threads_token_expires_at = ${newExpiry} WHERE username = ${u.username}`;
            }
          }
        } catch {}
      }
    } catch {}

    const pending = await sql`
      SELECT sp.id, sp.main_post, sp.reply_post, sp.reply_post2, sp.username,
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

    // 二重投稿防止：先にstatusを'processing'に変更してロック
    const pendingIds = pending.map(p => p.id);
    await sql`UPDATE scheduled_posts SET status = 'processing' WHERE id = ANY(${pendingIds}) AND status = 'pending'`;

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
          // トークン期限切れ（code 190）の場合は分かりやすいメッセージに変換
          const friendlyMsg = createText.includes('"code":190') || createText.includes("expired") || createText.includes("access token")
            ? "Threadsとの連携が切れました。会員情報ページから「再連携する」を押して、もう一度連携してください"
            : createText.slice(0, 500);
          await sql`UPDATE scheduled_posts SET status = 'failed', error_message = ${friendlyMsg} WHERE id = ${post.id}`;
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
          await new Promise(r => setTimeout(r, 5000));
          try {
            const replyCreateRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ media_type: "TEXT", text: post.reply_post, reply_to_id: threadId, access_token: token }),
            });
            const replyCreateText = await replyCreateRes.text();
            if (replyCreateRes.ok) {
              const replyIdMatch = replyCreateText.match(/"id"\s*:\s*"(\d+)"/);
              if (replyIdMatch) {
                await new Promise(r => setTimeout(r, 3000));
                const pubRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ creation_id: replyIdMatch[1], access_token: token }),
                });
                // リプ2があれば、リプ1にぶら下げて連投
                if (post.reply_post2?.trim()) {
                  try {
                    const pubText = await pubRes.text();
                    const reply1IdMatch = pubText.match(/"id"\s*:\s*"(\d+)"/);
                    const parentId = reply1IdMatch ? reply1IdMatch[1] : threadId;
                    await new Promise(r => setTimeout(r, 5000));
                    const r2CreateRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ media_type: "TEXT", text: post.reply_post2, reply_to_id: parentId, access_token: token }),
                    });
                    const r2CreateText = await r2CreateRes.text();
                    if (r2CreateRes.ok) {
                      const r2IdMatch = r2CreateText.match(/"id"\s*:\s*"(\d+)"/);
                      if (r2IdMatch) {
                        await new Promise(r => setTimeout(r, 3000));
                        await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ creation_id: r2IdMatch[1], access_token: token }),
                        });
                      }
                    } else {
                      await sql`UPDATE scheduled_posts SET error_message = ${"リプ2投稿失敗: " + r2CreateText.slice(0, 300)} WHERE id = ${post.id}`;
                    }
                  } catch (r2Err) {
                    await sql`UPDATE scheduled_posts SET error_message = ${"リプ2投稿エラー: " + (r2Err.message || "").slice(0, 300)} WHERE id = ${post.id}`;
                  }
                }
              }
            } else {
              // リプライ作成失敗をerror_messageに記録（statusはpostedのまま）
              await sql`UPDATE scheduled_posts SET error_message = ${"リプ投稿失敗: " + replyCreateText.slice(0, 300)} WHERE id = ${post.id}`;
            }
          } catch (replyErr) {
            await sql`UPDATE scheduled_posts SET error_message = ${"リプ投稿エラー: " + (replyErr.message || "").slice(0, 300)} WHERE id = ${post.id}`;
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
