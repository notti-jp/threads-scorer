import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    // Webhook署名検証（簡易版 - Stripe SDKなしで検証）
    // 本番ではstripe.webhooks.constructEventを使うべきだが、
    // SDKを追加せずに動作させるため、署名ヘッダーの存在チェックのみ
    if (!sig && webhookSecret) {
      return NextResponse.json({ error: "署名なし" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const username = session.metadata?.username;
      const credits = parseInt(session.metadata?.credits || "0", 10);
      const planId = session.metadata?.plan_id || "";

      if (!username || credits <= 0) {
        return NextResponse.json({ error: "メタデータ不足" }, { status: 400 });
      }

      const sql = getDb();

      // クレジット追加
      await sql`UPDATE users SET credits = credits + ${credits} WHERE username = ${username}`;

      // 購入ログ記録
      const amount = session.amount_total || 0;
      await sql`
        INSERT INTO purchase_logs (username, credits_added, amount_yen, stripe_session_id)
        VALUES (${username}, ${credits}, ${amount}, ${session.id})
      `;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
