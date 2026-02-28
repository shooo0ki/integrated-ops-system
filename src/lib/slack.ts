export type SlackChannel = "schedule" | "attendance" | "default";

/**
 * メールアドレスから Slack のメンション文字列を取得する
 * 見つからない場合は太字の名前を返す
 * 必要スコープ: users:read, users:read.email
 */
export async function getSlackMention(email: string, fallbackName: string): Promise<string> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log("[slack] SLACK_BOT_TOKEN not set, skipping mention lookup");
    return `*${fallbackName}*`;
  }

  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json() as { ok: boolean; error?: string; user?: { id: string } };
    console.log("[slack] lookupByEmail response:", JSON.stringify(data));
    if (data.ok && data.user?.id) return `<@${data.user.id}>`;
  } catch (err) {
    console.error("[slack] lookupByEmail error:", err);
  }
  return `*${fallbackName}*`;
}

/**
 * メールアドレスから Slack User ID を返す（DM 送信用）
 * 見つからない場合は null
 */
export async function getSlackUserId(email: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json() as { ok: boolean; user?: { id: string } };
    if (data.ok && data.user?.id) return data.user.id;
  } catch { /* ignore */ }
  return null;
}

/**
 * 指定ユーザーに Slack DM を送る
 * userId が null の場合は default チャンネルにフォールバック
 */
export async function sendSlackDM(userId: string | null, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  const channel = userId ?? process.env[CHANNEL_ENV["default"]];
  if (!channel) return;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text, mrkdwn: true }),
  });
}

const CHANNEL_ENV: Record<SlackChannel, string> = {
  schedule:   "SLACK_CHANNEL_SCHEDULE",
  attendance: "SLACK_CHANNEL_ATTENDANCE",
  default:    "SLACK_CHANNEL_DEFAULT",
};

export async function sendSlack(text: string, channel: SlackChannel = "default"): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  const channelId =
    process.env[CHANNEL_ENV[channel]] ??
    process.env[CHANNEL_ENV["default"]];
  if (!channelId) return;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: channelId, text, mrkdwn: true }),
  });
}
