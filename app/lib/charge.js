import { getDb } from "./db";

// ═══════ エラーで終わった回の回数を戻す ═══════
// 回数は画面側でAIを呼ぶ前に引いている（/api/credits の POST）。そのとき記録した usage_logs の
// created_at（文字列）を「引いた印」として画面から受け取り、サーバー側でエラーになったときだけここで戻す。
// ・戻すかどうかはサーバーが決める（画面から「戻して」と頼む窓口は作らない。成功した回まで戻せてしまうため）
// ・1つの印で戻せるのは1回だけ。記録の action を「〜_refunded」に書き換えるので、二重には戻らない
//   （記録は消さずに残す。失敗した回もAPIの費用はかかっているので、利用状況の集計で数えられるようにする）
// ・引いてから15分以内のものだけ
// ・「記録の書き換え」と「回数を戻す」を1つのSQLで行うので、片方だけ実行されることはない
export async function refundCharge(username, chargeId, action) {
  if (!username || !chargeId || !action) return null;
  try {
    const sql = getDb();
    const refundedAction = `${action}_refunded`;
    const rows = await sql`
      WITH r AS (
        UPDATE usage_logs SET action = ${refundedAction}
        WHERE username = ${username} AND action = ${action}
          AND created_at::text = ${String(chargeId)}
          AND created_at > now() - interval '15 minutes'
        RETURNING username
      )
      UPDATE users SET credits = credits + 1
      WHERE username IN (SELECT username FROM r)
      RETURNING credits
    `;
    if (rows.length === 0) return null;
    console.log(`[refund] ${action} を1回分戻した`);
    return { credits: rows[0].credits };
  } catch (e) {
    console.error(`[refund] 失敗: ${e.message}`);
    return null;
  }
}
