import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

// 月初リセット処理（毎月1日に100追加）
async function checkMonthlyReset(sql, username) {
  const user = await sql`SELECT credits, credits_reset_at FROM users WHERE username = ${username}`;
  if (user.length === 0) return;

  const lastReset = new Date(user[0].credits_reset_at);
  const now = new Date();

  // 今月1日の0時
  const thisMonthFirst = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  // 前回のリセットが今月1日より前なら、100回追加
  if (lastReset < thisMonthFirst) {
    await sql`
      UPDATE users 
      SET credits = credits + 100, credits_reset_at = ${thisMonthFirst.toISOString()}
      WHERE username = ${username}
    `;
  }
}

// GET: クレジット残高を取得
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();

    // 月初リセットチェック
    await checkMonthlyReset(sql, username);

    const user = await sql`SELECT credits FROM users WHERE username = ${username}`;
    if (user.length === 0) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

    // 今月の利用回数
    const thisMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const usageThisMonth = await sql`
      SELECT COUNT(*) as count FROM usage_logs 
      WHERE username = ${username} AND created_at >= ${thisMonthFirst.toISOString()}
    `;

    return NextResponse.json({
      credits: user[0].credits,
      usedThisMonth: Number(usageThisMonth[0].count),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: クレジットを消費（API呼び出し前にチェック）
export async function POST(request) {
  try {
    const { username, action } = await request.json();
    if (!username || !action) return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });

    const sql = getDb();

    // 月初リセットチェック
    await checkMonthlyReset(sql, username);

    // 残高チェック
    const user = await sql`SELECT credits FROM users WHERE username = ${username}`;
    if (user.length === 0) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

    if (user[0].credits <= 0) {
      return NextResponse.json({ 
        error: "利用回数の上限に達しました。追加クレジットを購入してください。",
        needPurchase: true 
      }, { status: 403 });
    }

    // クレジット消費＋ログ記録
    await sql`UPDATE users SET credits = credits - 1 WHERE username = ${username}`;
    await sql`INSERT INTO usage_logs (username, action) VALUES (${username}, ${action})`;

    const updated = await sql`SELECT credits FROM users WHERE username = ${username}`;
    return NextResponse.json({ result: "ok", credits: updated[0].credits });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
