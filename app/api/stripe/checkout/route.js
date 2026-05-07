import { NextResponse } from "next/server";

const PLANS = {
  plan100: { credits: 100, amount: 1200, label: "100回分" },
  plan200: { credits: 200, amount: 2200, label: "200回分" },
  plan300: { credits: 300, amount: 3000, label: "300回分" },
};

export async function POST(request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "Stripe未設定" }, { status: 500 });

  try {
    const { planId, username } = await request.json();
    const plan = PLANS[planId];
    if (!plan) return NextResponse.json({ error: "無効なプラン" }, { status: 400 });
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const appUrl = process.env.APP_URL || "https://notti.jp";

    // Stripe Checkout Session作成
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "payment",
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "jpy",
        "line_items[0][price_data][unit_amount]": String(plan.amount),
        "line_items[0][price_data][product_data][name]": `キニナルメーカー 追加クレジット ${plan.label}`,
        "line_items[0][quantity]": "1",
        "success_url": `${appUrl}?purchase=success`,
        "cancel_url": `${appUrl}?purchase=cancel`,
        "metadata[username]": username,
        "metadata[plan_id]": planId,
        "metadata[credits]": String(plan.credits),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: "決済セッション作成に失敗しました" }, { status: 502 });
    }

    const session = await res.json();
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
