// タブA専用：「何がプロフィールを開かせたか」の考察を作って保存する
//
// フィードバックに記録した「プロフィールへのアクセス」を、ビューに対する率で見て、
// 多かった投稿と少なかった投稿を比べた結論（450〜600字）を1ユーザー1件で保存する。
// タブAの生成はこの結論を毎回参照する（/api/analyze）。
//
//   ・作るのは、プロフィールへのアクセスを記録した投稿が6件たまってから（多い側・少ない側を3件ずつ比べるため）
//   ・以後は3件増えるごとに作り直す。それ以外のときは保存済みのものを返すだけで、APIは呼ばない
//   ・1回あたり約2〜3円。回数（クレジット）は使わない
import { NextResponse } from "next/server";
import { PROFILE_INSIGHT_PROMPT } from "../../../prompts";
import { getDb } from "../../../lib/db";
import { rankByProfileRate, buildInsightInput, shouldRefreshInsight, MIN_EXAMPLES, MIN_INSIGHT, REFRESH_STEP } from "../../../lib/profileSignal";

const MODEL = "claude-sonnet-5";

// プロフィールへのアクセスが記録された投稿を読む。列がまだ無いDBでは null を返す
async function loadProfileRows(sql, username) {
  try {
    return await sql`
      SELECT main_post, reply_post, views, profile_views, mode
      FROM feedbacks
      WHERE username = ${username} AND views > 0 AND profile_views IS NOT NULL
        AND main_post IS NOT NULL AND main_post <> ''
      ORDER BY created_at DESC
      LIMIT 200
    `;
  } catch (e) {
    console.error(`[insight] profile_views を読めません（列が未追加の可能性）: ${e.message}`);
    return null;
  }
}

async function loadInsight(sql, username) {
  try {
    const rows = await sql`SELECT insight, data_count, updated_at FROM profile_insights WHERE username = ${username} LIMIT 1`;
    return rows[0] || null;
  } catch (e) {
    console.error(`[insight] profile_insights を読めません（テーブルが未作成の可能性）: ${e.message}`);
    return null;
  }
}

// 画面に返す形。考察・件数・あと何件で始まるか（または作り直されるか）
function shape(insightRow, n) {
  return {
    insight: insightRow ? { text: insightRow.insight, dataCount: insightRow.data_count, updatedAt: insightRow.updated_at } : null,
    dataCount: n,
    minExamples: MIN_EXAMPLES,
    minInsight: MIN_INSIGHT,
    untilInsight: Math.max(0, MIN_INSIGHT - n),
    untilRefresh: insightRow ? Math.max(0, Number(insightRow.data_count) + REFRESH_STEP - n) : null,
  };
}

// 保存済みの考察と、いまの件数を返す（APIは呼ばない）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });
    const sql = getDb();
    const rows = await loadProfileRows(sql, username);
    if (rows === null) return NextResponse.json({ available: false });
    const sig = rankByProfileRate(rows);
    return NextResponse.json({ available: true, ...shape(await loadInsight(sql, username), sig.n) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 必要なときだけ考察を作り直す。フィードバックを保存・更新したあとに画面から呼ぶ
export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const sql = getDb();
    const rows = await loadProfileRows(sql, username);
    if (rows === null) return NextResponse.json({ available: false });

    const sig = rankByProfileRate(rows);
    const current = await loadInsight(sql, username);

    // 件数が足りない／前回から3件増えていない／アクセスが全部0、のときは何もしない
    if (!shouldRefreshInsight(sig.n, current?.data_count) || sig.avg <= 0) {
      return NextResponse.json({ available: true, refreshed: false, ...shape(current, sig.n) });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        thinking: { type: "disabled" }, // Sonnet 5 は省略すると思考が自動でONになり、出力単価で課金される
        output_config: { effort: "high" },
        system: [{ type: "text", text: PROFILE_INSIGHT_PROMPT }],
        messages: [{ role: "user", content: buildInsightInput(sig) }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[apierr] profile-insight status=${res.status} body=${errBody.slice(0, 300)}`);
      // 作り直せなくても、保存済みの考察はそのまま使える
      return NextResponse.json({ available: true, refreshed: false, ...shape(current, sig.n) });
    }
    const data = await res.json();
    const u = data.usage || {};
    console.log(`[usage] profile-insight in=${u.input_tokens || 0} out=${u.output_tokens || 0} n=${sig.n}`);

    const raw = data.content?.map(c => c.text || "").join("") || "";
    const m = raw.match(/\[INSIGHT\]\s*([\s\S]*?)\s*\[\/INSIGHT\]/);
    if (!m) return NextResponse.json({ available: true, refreshed: false, ...shape(current, sig.n) });
    const insight = m[1].trim().slice(0, 900);

    try {
      await sql`INSERT INTO users (username) VALUES (${username}) ON CONFLICT (username) DO NOTHING`;
      await sql`
        INSERT INTO profile_insights (username, insight, data_count, updated_at)
        VALUES (${username}, ${insight}, ${sig.n}, NOW())
        ON CONFLICT (username) DO UPDATE
          SET insight = EXCLUDED.insight, data_count = EXCLUDED.data_count, updated_at = NOW()
      `;
    } catch (e) {
      console.error(`[insight] 保存に失敗（テーブルが未作成の可能性）: ${e.message}`);
      return NextResponse.json({ available: true, refreshed: false, ...shape(current, sig.n) });
    }

    return NextResponse.json({
      available: true,
      refreshed: true,
      ...shape({ insight, data_count: sig.n, updated_at: new Date().toISOString() }, sig.n),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
