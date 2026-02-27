export type SlackChannel = "schedule" | "attendance" | "default";

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
