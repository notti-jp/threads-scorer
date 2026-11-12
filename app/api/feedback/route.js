import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

// フィードバック取得（ユーザー別）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    const rows = await sql`
      SELECT * FROM feedbacks 
      WHERE username = ${username} 
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// フィードバック保存
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, mainPost, replyPost, views, likes, comments, mode, source, hookLine, trace, profileViews } = body;

    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();

    // ユーザーが存在しなければ作成
    await sql`
      INSERT INTO users (username) VALUES (${username})
      ON CONFLICT (username) DO NOTHING
    `;

    // フィードバック保存
    // ★タブAの生成から来た投稿は mode / source / hook_line を添えて保存する。
    //   これまで「アプリが作ったどの投稿が伸びたか」を知る手段が無く、何本作っても学べなかった。
    //   列がまだ追加されていないDBでも保存が止まらないよう、失敗したら従来の形で保存する
    //   trace は「noteのどの仕掛けを使った回か」（none / vocab / presup）。仕掛けごとの伸びを比べるために残す。
    //   列の追加が段階的でも止まらないよう、新しい列から順に3段階で試す
    let result;
    try {
      result = await sql`
        INSERT INTO feedbacks (username, main_post, reply_post, views, likes, comments, posted_at, mode, source, hook_line, trace)
        VALUES (${username}, ${mainPost || ""}, ${replyPost || ""}, ${views || null}, ${likes || null}, ${comments || null}, NOW(),
                ${mode || null}, ${source || null}, ${hookLine || null}, ${trace || null})
        RETURNING id
      `;
    } catch (e1) {
      console.error(`[feedback] trace列つきの保存に失敗（列が未追加の可能性）: ${e1.message}`);
      try {
        result = await sql`
          INSERT INTO feedbacks (username, main_post, reply_post, views, likes, comments, posted_at, mode, source, hook_line)
          VALUES (${username}, ${mainPost || ""}, ${replyPost || ""}, ${views || null}, ${likes || null}, ${comments || null}, NOW(),
                  ${mode || null}, ${source || null}, ${hookLine || null})
          RETURNING id
        `;
      } catch (e2) {
        console.error(`[feedback] 拡張列での保存に失敗（列が未追加の可能性）: ${e2.message}`);
        result = await sql`
          INSERT INTO feedbacks (username, main_post, reply_post, views, likes, comments, posted_at)
          VALUES (${username}, ${mainPost || ""}, ${replyPost || ""}, ${views || null}, ${likes || null}, ${comments || null}, NOW())
          RETURNING id
        `;
      }
    }

    // プロフィールへのアクセスは別に書き込む。列がまだ無いDBでも、上の保存そのものは止めないため
    if (profileViews !== null && profileViews !== undefined && profileViews !== "") {
      try {
        await sql`UPDATE feedbacks SET profile_views = ${Number(profileViews)} WHERE id = ${result[0].id}`;
      } catch (e) {
        console.error(`[feedback] profile_views の保存に失敗（列が未追加の可能性）: ${e.message}`);
      }
    }

    return NextResponse.json({ result: "ok", id: result[0].id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 登録済みのフィードバックを更新する。
// 送られてきた項目だけを書き換える（送られていない項目は元のまま）。
//   ・編集フォームからは、本文・リプ・数値・形式をまとめて送る
//   ・一覧の「プロフィールへのアクセス」欄からは profileViews だけを送る
// インサイトの数字は投稿の数日後に固まることが多いので、登録後に直せることが前提になる。
// 生成時の記録（source / hook_line / trace）は、あとから変えると集計が狂うため更新の対象にしない
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, username } = body;
    if (!id || !username) return NextResponse.json({ error: "IDとユーザー名が必要です" }, { status: 400 });
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    // 数値は「空なら未入力（null）」「入っていれば0以上の整数」
    const num = (v, label) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error(`${label}には0以上の数を入力してください`), { status: 400 });
      return Math.round(n);
    };

    const sql = getDb();
    const rows = await sql`SELECT id, main_post, reply_post, views, likes, comments FROM feedbacks WHERE id = ${id} AND username = ${username}`;
    if (rows.length === 0) return NextResponse.json({ error: "フィードバックが見つかりません" }, { status: 404 });
    const cur = rows[0];

    if (has("mainPost") && !String(body.mainPost || "").trim()) {
      return NextResponse.json({ error: "投稿文を入力してください" }, { status: 400 });
    }
    const next = {
      main_post: has("mainPost") ? String(body.mainPost) : cur.main_post,
      reply_post: has("replyPost") ? String(body.replyPost || "") : cur.reply_post,
      views: has("views") ? num(body.views, "ビュー数") : cur.views,
      likes: has("likes") ? num(body.likes, "いいね数") : cur.likes,
      comments: has("comments") ? num(body.comments, "コメント数") : cur.comments,
    };
    await sql`
      UPDATE feedbacks
      SET main_post = ${next.main_post}, reply_post = ${next.reply_post},
          views = ${next.views}, likes = ${next.likes}, comments = ${next.comments}
      WHERE id = ${id} AND username = ${username}
    `;

    // あとから追加した列は別々に書く。列がまだ無いDBでも、上の更新は止めない
    if (has("mode")) {
      try {
        await sql`UPDATE feedbacks SET mode = ${body.mode || null} WHERE id = ${id} AND username = ${username}`;
      } catch (e) {
        console.error(`[feedback] mode の更新に失敗（列が未追加の可能性）: ${e.message}`);
      }
    }
    if (has("profileViews")) {
      const n = num(body.profileViews, "プロフィールへのアクセス");
      try {
        await sql`UPDATE feedbacks SET profile_views = ${n} WHERE id = ${id} AND username = ${username}`;
      } catch (e) {
        console.error(`[feedback] profile_views の更新に失敗（列が未追加の可能性）: ${e.message}`);
        // プロフィールへのアクセスだけを送ってきた場合は、保存できなかったことを伝える
        if (Object.keys(body).filter(k => k !== "id" && k !== "username").length === 1) {
          return NextResponse.json({ error: "プロフィールへのアクセスを保存できませんでした。管理者にお問い合わせください。" }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// フィードバック削除
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const username = searchParams.get("username");
    if (!id || !username) return NextResponse.json({ error: "IDとユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    await sql`DELETE FROM feedbacks WHERE id = ${id} AND username = ${username}`;
    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
