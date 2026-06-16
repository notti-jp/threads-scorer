import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const username = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.APP_URL || "https://notti.jp";

  if (error || !code || !username) {
    return NextResponse.redirect(`${appUrl}?threads_connect=error`);
  }

  try {
    const appId = process.env.THREADS_APP_ID;
    const appSecret = process.env.THREADS_APP_SECRET;
    const redirectUri = `${appUrl}/api/threads/callback`;

    // Step1: 認証コード → 短期トークン
    const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}?threads_connect=error`);
    }
    // user_idが大きな数値のため、JSONパースで精度が失われる問題を回避
    const tokenText = await tokenRes.text();
    const tokenData = JSON.parse(tokenText);
    const shortToken = tokenData.access_token;
    // user_idを文字列として正確に取得
    const userIdMatch = tokenText.match(/"user_id"\s*:\s*(\d+)/);
    const userId = userIdMatch ? userIdMatch[1] : String(tokenData.user_id);

    // Step2: 短期トークン → 長期トークン（60日）
    const longRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    );

    let finalToken = shortToken;
    let expiresIn = 3600;

    if (longRes.ok) {
      const longData = await longRes.json();
      finalToken = longData.access_token || shortToken;
      expiresIn = longData.expires_in || 5184000;
    }

    // 有効期限を計算
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Step3: DBに保存
    const sql = getDb();
    await sql`
      UPDATE users SET
        threads_access_token = ${finalToken},
        threads_user_id = ${String(userId)},
        threads_token_expires_at = ${expiresAt.toISOString()}
      WHERE username = ${username}
    `;

    return NextResponse.redirect(`${appUrl}?threads_connect=success`);
  } catch (e) {
    return NextResponse.redirect(`${appUrl}?threads_connect=error`);
  }
}
