import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

function genToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

function maskEmail(email) {
  const [user, domain] = email.split("@");
  const masked = user.slice(0, 3) + "***";
  return masked + "@" + domain;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const sql = getDb();

    // ═══════ STEP1: ユーザー名重複チェック ═══════
    if (action === "checkUsername") {
      const { username } = body;
      if (!username?.trim()) return NextResponse.json({ error: "ユーザー名を入力してください" }, { status: 400 });
      if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) return NextResponse.json({ error: "ユーザー名は英数字とアンダースコアのみ使用できます" }, { status: 400 });
      if (username.trim().length < 2) return NextResponse.json({ error: "ユーザー名は2文字以上にしてください" }, { status: 400 });
      if (username.trim().length > 20) return NextResponse.json({ error: "ユーザー名は20文字以内にしてください" }, { status: 400 });

      const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()}`;
      if (existing.length > 0) return NextResponse.json({ error: "このユーザー名は既に使われています" }, { status: 409 });

      return NextResponse.json({ result: "ok", available: true });
    }

    // ═══════ STEP2: 会員登録完了 ═══════
    if (action === "register") {
      const { username, email, password, birthday, threadsAccount } = body;

      if (!username?.trim()) return NextResponse.json({ error: "ユーザー名を入力してください" }, { status: 400 });
      if (!email?.trim()) return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
      if (!password?.trim()) return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
      if (password.trim().length < 4) return NextResponse.json({ error: "パスワードは4文字以上にしてください" }, { status: 400 });
      if (!birthday) return NextResponse.json({ error: "生年月日を入力してください" }, { status: 400 });

      // 再度重複チェック
      const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()}`;
      if (existing.length > 0) return NextResponse.json({ error: "このユーザー名は既に使われています" }, { status: 409 });

      await sql`
        INSERT INTO users (username, password, email, birthday, threads_account)
        VALUES (${username.trim()}, ${password.trim()}, ${email.trim()}, ${birthday}, ${threadsAccount?.trim() || ""})
      `;

      return NextResponse.json({ result: "ok", username: username.trim() });
    }

    // ═══════ ログイン ═══════
    if (action === "login") {
      const { username, password } = body;
      if (!username?.trim() || !password?.trim()) return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 });

      const user = await sql`SELECT id, username FROM users WHERE username = ${username.trim()} AND password = ${password.trim()}`;
      if (user.length === 0) return NextResponse.json({ error: "ユーザー名またはパスワードが違います" }, { status: 401 });

      return NextResponse.json({ result: "ok", username: user[0].username });
    }

    // ═══════ パスワードリセット申請 ═══════
    if (action === "requestReset") {
      const { username, email, birthday } = body;
      if (!username?.trim() || !email?.trim() || !birthday) return NextResponse.json({ error: "すべての項目を入力してください" }, { status: 400 });

      const user = await sql`
        SELECT id, username, email FROM users 
        WHERE username = ${username.trim()} AND email = ${email.trim()} AND birthday = ${birthday}
      `;
      if (user.length === 0) return NextResponse.json({ error: "入力された情報に一致するアカウントが見つかりません" }, { status: 404 });

      // トークン生成（10分有効）
      const token = genToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await sql`INSERT INTO password_reset_tokens (username, token, expires_at) VALUES (${username.trim()}, ${token}, ${expiresAt})`;

      // メール送信（Resend API）
      const appUrl = process.env.APP_URL || "https://notti.jp";
      const resetUrl = `${appUrl}?reset=${token}`;
      const resendKey = process.env.RESEND_API_KEY;

      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: "Threads投稿エンジン <noreply@notti.jp>",
              to: [email.trim()],
              subject: "パスワード再設定のご案内",
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                  <h2 style="color:#2c425a;">パスワード再設定</h2>
                  <p>${username.trim()} さん、</p>
                  <p>パスワード再設定のリクエストを受け付けました。<br>以下のリンクから10分以内に新しいパスワードを設定してください。</p>
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#2c425a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0;">パスワードを再設定する</a>
                  <p style="color:#888;font-size:13px;">このリクエストに心当たりがない場合は、このメールを無視してください。</p>
                </div>
              `,
            }),
          });
        } catch (emailErr) {
          return NextResponse.json({ error: "メール送信に失敗しました。しばらくしてからお試しください。" }, { status: 500 });
        }
      }

      const maskedEmail = maskEmail(email.trim());
      return NextResponse.json({ result: "ok", maskedEmail });
    }

    // ═══════ パスワードリセット実行 ═══════
    if (action === "executeReset") {
      const { token, newPassword } = body;
      if (!token || !newPassword?.trim()) return NextResponse.json({ error: "新しいパスワードを入力してください" }, { status: 400 });
      if (newPassword.trim().length < 4) return NextResponse.json({ error: "パスワードは4文字以上にしてください" }, { status: 400 });

      const tokenRow = await sql`
        SELECT username, expires_at, used FROM password_reset_tokens WHERE token = ${token}
      `;
      if (tokenRow.length === 0) return NextResponse.json({ error: "無効なリンクです" }, { status: 400 });
      if (tokenRow[0].used) return NextResponse.json({ error: "このリンクは既に使用されています" }, { status: 400 });
      if (new Date(tokenRow[0].expires_at) < new Date()) return NextResponse.json({ error: "このリンクは期限切れです（10分以内にご利用ください）" }, { status: 400 });

      await sql`UPDATE users SET password = ${newPassword.trim()} WHERE username = ${tokenRow[0].username}`;
      await sql`UPDATE password_reset_tokens SET used = TRUE WHERE token = ${token}`;

      return NextResponse.json({ result: "ok" });
    }

    // ═══════ 会員情報取得 ═══════
    if (action === "getProfile") {
      const { username } = body;
      if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

      const user = await sql`SELECT username, email, birthday, threads_account FROM users WHERE username = ${username}`;
      if (user.length === 0) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

      return NextResponse.json({ result: "ok", profile: user[0] });
    }

    // ═══════ 会員情報更新 ═══════
    if (action === "updateProfile") {
      const { username, currentPassword, email, birthday, threadsAccount, newPassword } = body;
      if (!username || !currentPassword) return NextResponse.json({ error: "現在のパスワードを入力してください" }, { status: 400 });

      // 現在のパスワードで本人確認
      const user = await sql`SELECT id FROM users WHERE username = ${username} AND password = ${currentPassword}`;
      if (user.length === 0) return NextResponse.json({ error: "現在のパスワードが違います" }, { status: 401 });

      // 更新
      if (newPassword?.trim() && newPassword.trim().length < 4) return NextResponse.json({ error: "新しいパスワードは4文字以上にしてください" }, { status: 400 });

      await sql`
        UPDATE users SET 
          email = ${email?.trim() || ""},
          birthday = ${birthday || null},
          threads_account = ${threadsAccount?.trim() || ""}
          ${newPassword?.trim() ? sql`, password = ${newPassword.trim()}` : sql``}
        WHERE username = ${username}
      `;

      return NextResponse.json({ result: "ok" });
    }

    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
