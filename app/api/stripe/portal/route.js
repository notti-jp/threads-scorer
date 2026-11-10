import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export async function POST(request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "Stripe未設定" }, { status: 500 });

  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    const user = await sql`SELECT stripe_customer_id FROM users WHERE username = ${username}`;
    if (user.length === 0 || !user[0].stripe_customer_id) {
      return NextResponse.json({ error: "サブスクリプション情報が見つかりません" }, { status: 404 });
    }

    const appUrl = process.env.APP_URL || "https://notti.jp";

    // Stripe Customer Portal セッション作成
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        "customer": user[0].stripe_customer_id,
        "return_url": appUrl,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "ポータルの作成に失敗しました" }, { status: 502 });

    const session = await res.json();
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
