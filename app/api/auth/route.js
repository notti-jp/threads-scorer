import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export async function POST(request) {
  try {
    const { action, username, password } = await request.json();
    
    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 });
    }

    const sql = getDb();

    // ═══════ 新規登録 ═══════
    if (action === "register") {
      // ユーザー名の重複チェック
      const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()}`;
      if (existing.length > 0) {
        return NextResponse.json({ error: "このユーザー名は既に使われています。別の名前を入力してください。" }, { status: 409 });
      }

      // ユーザー名のバリデーション
      if (username.trim().length < 2) {
        return NextResponse.json({ error: "ユーザー名は2文字以上にしてください" }, { status: 400 });
      }
      if (username.trim().length > 20) {
        return NextResponse.json({ error: "ユーザー名は20文字以内にしてください" }, { status: 400 });
      }
      if (password.trim().length < 4) {
        return NextResponse.json({ error: "パスワードは4文字以上にしてください" }, { status: 400 });
      }

      // 登録
      await sql`INSERT INTO users (username, password) VALUES (${username.trim()}, ${password.trim()})`;
      return NextResponse.json({ result: "ok", username: username.trim() });
    }

    // ═══════ ログイン ═══════
    if (action === "login") {
      const user = await sql`SELECT id, username FROM users WHERE username = ${username.trim()} AND password = ${password.trim()}`;
      if (user.length === 0) {
        return NextResponse.json({ error: "ユーザー名またはパスワードが違います" }, { status: 401 });
      }
      return NextResponse.json({ result: "ok", username: user[0].username });
    }

    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
