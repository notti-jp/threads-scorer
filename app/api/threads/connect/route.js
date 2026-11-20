import { NextResponse } from "next/server";

export async function POST(request) {
  const appId = process.env.THREADS_APP_ID;
  if (!appId) return NextResponse.json({ error: "THREADS_APP_ID未設定" }, { status: 500 });

  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    const appUrl = process.env.APP_URL || "https://notti.jp";
    const redirectUri = `${appUrl}/api/threads/callback`;
    const scope = "threads_basic,threads_content_publish,threads_manage_replies";

    const authUrl = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${encodeURIComponent(username)}`;

    return NextResponse.json({ url: authUrl });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
