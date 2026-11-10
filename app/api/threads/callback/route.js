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
    // user_idが大きな数値のため、JSONパースで精度が失われる問題を回避（文字列として取得）
    const tokenText = await tokenRes.text();
    const shortTokenMatch = tokenText.match(/"access_token"\s*:\s*"([^"]+)"/);
    const shortToken = shortTokenMatch ? shortTokenMatch[1] : null;
    const userIdMatch = tokenText.match(/"user_id"\s*:\s*"?(\d+)"?/);
    const userId = userIdMatch ? userIdMatch[1] : null;

    if (!shortToken || !userId) {
      return NextResponse.redirect(`${appUrl}?threads_connect=error`);
    }

    // Step2: 短期トークン → 長期トークン（60日）
    const longRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    );
    const longText = await longRes.text();

    let finalToken = null;
    let expiresIn = null;

    if (longRes.ok) {
      const tokenMatch = longText.match(/"access_token"\s*:\s*"([^"]+)"/);
      const expiresMatch = longText.match(/"expires_in"\s*:\s*(\d+)/);
      if (tokenMatch) {
        finalToken = tokenMatch[1];
        expiresIn = expiresMatch ? parseInt(expiresMatch[1]) : 5184000;
      }
    }

    // 長期トークンの取得に失敗した場合はエラーにする（短期トークンを保存しない）
    if (!finalToken) {
      return NextResponse.redirect(`${appUrl}?threads_connect=error`);
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
