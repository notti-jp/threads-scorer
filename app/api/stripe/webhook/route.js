import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export async function POST(request) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "署名なし" }, { status: 400 });

    const event = JSON.parse(body);
    const sql = getDb();

    // ═══════ サブスクリプション初回登録完了 ═══════
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const username = session.metadata?.username;
      const type = session.metadata?.type;

      if (type === "subscription" && username) {
        // サブスク登録：ユーザーにStripe情報を紐づけ＋初期クレジット100付与
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        await sql`
          UPDATE users SET 
            stripe_customer_id = ${customerId},
            stripe_subscription_id = ${subscriptionId},
            subscription_status = 'active',
            subscription_started_at = NOW(),
            credits = credits + 100
          WHERE username = ${username}
        `;
        // ログ記録
        await sql`
          INSERT INTO purchase_logs (username, credits_added, amount_yen, stripe_session_id)
          VALUES (${username}, 100, 1980, ${session.id})
        `;
      } else if (type === "credits" && username) {
        // 追加クレジット購入
        const credits = parseInt(session.metadata?.credits || "0", 10);
        if (credits > 0) {
          await sql`UPDATE users SET credits = credits + ${credits} WHERE username = ${username}`;
          await sql`
            INSERT INTO purchase_logs (username, credits_added, amount_yen, stripe_session_id)
            VALUES (${username}, ${credits}, ${session.amount_total || 0}, ${session.id})
          `;
        }
      }
    }

    // ═══════ 毎月の自動課金成功（サブスク更新） ═══════
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      // 初回のinvoice（サブスク作成時）はcheckout.session.completedで処理済みなのでスキップ
      if (invoice.billing_reason === "subscription_cycle") {
        const subscriptionId = invoice.subscription;
        // subscription_idからユーザーを特定
        const users = await sql`
          SELECT username FROM users WHERE stripe_subscription_id = ${subscriptionId}
        `;
        if (users.length > 0) {
          const username = users[0].username;
          await sql`UPDATE users SET credits = credits + 100 WHERE username = ${username}`;
          await sql`
            INSERT INTO purchase_logs (username, credits_added, amount_yen, stripe_session_id)
            VALUES (${username}, 100, ${invoice.amount_paid || 1980}, ${invoice.id})
          `;
        }
      }
    }

    // ═══════ サブスクリプション解約 ═══════
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;
      await sql`
        UPDATE users SET subscription_status = 'cancelled'
        WHERE stripe_subscription_id = ${subscriptionId}
      `;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
