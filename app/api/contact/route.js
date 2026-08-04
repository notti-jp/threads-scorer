import { NextResponse } from "next/server";

export async function POST(request) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "メール送信が設定されていません" }, { status: 500 });

  try {
    const { name, email, category, message } = await request.json();

    if (!name?.trim()) return NextResponse.json({ error: "お名前を入力してください" }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
    if (!message?.trim()) return NextResponse.json({ error: "お問い合わせ内容を入力してください" }, { status: 400 });

    // 管理者宛にメール送信
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "キニナルメーカー <noreply@notti.jp>",
        to: ["kawashima.go@gmail.com"],
        subject: `【お問い合わせ】${category || "その他"} - ${name.trim()}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="color:#0a0a0a;border-bottom:1px solid #E5E5E5;padding-bottom:12px;">キニナルメーカー お問い合わせ</h2>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px 0;color:#888;width:100px;">お名前</td><td style="padding:8px 0;color:#1A1A1A;">${name.trim()}</td></tr>
              <tr><td style="padding:8px 0;color:#888;">メール</td><td style="padding:8px 0;color:#1A1A1A;">${email.trim()}</td></tr>
              <tr><td style="padding:8px 0;color:#888;">カテゴリ</td><td style="padding:8px 0;color:#1A1A1A;">${category || "その他"}</td></tr>
            </table>
            <div style="background:#FAFAFA;border:1px solid #E5E5E5;border-radius:8px;padding:16px;margin-top:12px;">
              <div style="color:#888;font-size:12px;margin-bottom:8px;">お問い合わせ内容</div>
              <div style="color:#1A1A1A;line-height:1.8;white-space:pre-wrap;">${message.trim()}</div>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "送信に失敗しました。しばらくしてからお試しください。" }, { status: 502 });

    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
