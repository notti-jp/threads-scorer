import { NextResponse } from "next/server";

// Threads APIで投稿を作成・公開
async function publishToThreads(accessToken, userId, text) {
  // Step1: メディアコンテナを作成
  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: accessToken }),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || `Threads API error: ${createRes.status}`);
  }
  const { id: containerId } = await createRes.json();

  // Step2: 公開
  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(err.error?.message || `Publish error: ${publishRes.status}`);
  }
  return await publishRes.json();
}

// リプライを作成・公開
async function publishReply(accessToken, userId, parentId, text) {
  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, reply_to_id: parentId, access_token: accessToken }),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || `Reply create error: ${createRes.status}`);
  }
  const { id: containerId } = await createRes.json();

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(err.error?.message || `Reply publish error: ${publishRes.status}`);
  }
  return await publishRes.json();
}

export async function POST(request) {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: "THREADS_ACCESS_TOKEN未設定" }, { status: 500 });

  try {
    const { mainPost, replyPost } = await request.json();
    if (!mainPost?.trim()) return NextResponse.json({ error: "投稿文が空です" }, { status: 400 });

    // ユーザーIDを取得
    const meRes = await fetch(`https://graph.threads.net/v1.0/me?access_token=${accessToken}`);
    if (!meRes.ok) throw new Error("ユーザー情報の取得に失敗しました。アクセストークンを確認してください");
    const { id: userId } = await meRes.json();

    // 本投稿を公開
    const mainResult = await publishToThreads(accessToken, userId, mainPost.trim());

    // リプライがあれば公開
    let replyResult = null;
    if (replyPost?.trim()) {
      // 少し待つ（Threads APIの処理時間確保）
      await new Promise(r => setTimeout(r, 3000));
      replyResult = await publishReply(accessToken, userId, mainResult.id, replyPost.trim());
    }

    return NextResponse.json({ success: true, mainId: mainResult.id, replyId: replyResult?.id || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
