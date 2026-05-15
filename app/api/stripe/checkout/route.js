import { NextResponse } from "next/server";

// 追加クレジット購入プラン（都度購入）
const CREDIT_PLANS = {
  plan100: { credits: 100, amount: 1200, label: "100回分" },
  plan200: { credits: 200, amount: 2200, label: "200回分" },
  plan300: { credits: 300, amount: 3000, label: "300回分" },
};

export async function POST(request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeKey) return NextResponse.json({ error: "Stripe未設定" }, { status: 500 });

  try {
    const { type, planId, username, couponCode } = await request.json();
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const appUrl = process.env.APP_URL || "https://notti.jp";

    // ═══════ サブスクリプション登録 ═══════
    if (type === "subscription") {
      if (!priceId) return NextResponse.json({ error: "STRIPE_PRICE_ID未設定" }, { status: 500 });

      // クーポンコードの検証（入力がある場合）
      let promotionCodeId = null;
      if (couponCode?.trim()) {
        const promoRes = await fetch(`https://api.stripe.com/v1/promotion_codes?code=${encodeURIComponent(couponCode.trim())}&active=true`, {
          headers: { "Authorization": `Bearer ${stripeKey}` },
        });
        const promoData = await promoRes.json();
        if (promoData.data && promoData.data.length > 0) {
          promotionCodeId = promoData.data[0].id;
        } else {
          return NextResponse.json({ error: "無効な割引コードです" }, { status: 400 });
        }
      }

      const params = new URLSearchParams({
        "mode": "subscription",
        "payment_method_types[0]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "success_url": `${appUrl}?subscription=success`,
        "cancel_url": `${appUrl}?subscription=cancel`,
        "metadata[username]": username,
        "metadata[type]": "subscription",
        "subscription_data[metadata][username]": username,
      });

      if (promotionCodeId) {
        params.append("discounts[0][promotion_code]", promotionCodeId);
      }

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: "決済セッション作成に失敗しました" }, { status: 502 });
      }
      const session = await res.json();
      return NextResponse.json({ url: session.url });
    }

    // ═══════ 追加クレジット購入（都度） ═══════
    if (type === "credits") {
      const plan = CREDIT_PLANS[planId];
      if (!plan) return NextResponse.json({ error: "無効なプラン" }, { status: 400 });

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
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
          "metadata[type]": "credits",
          "metadata[plan_id]": planId,
          "metadata[credits]": String(plan.credits),
        }),
      });

      if (!res.ok) return NextResponse.json({ error: "決済セッション作成に失敗しました" }, { status: 502 });
      const session = await res.json();
      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "無効なリクエスト" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
