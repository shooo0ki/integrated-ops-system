import { google } from "googleapis";
import { prisma } from "@/backend/db";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/** OAuth 同意画面の URL を生成 */
export function getAuthUrl(memberId: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: memberId,
  });
}

/** OAuth コールバックでトークンを保存 */
export async function handleCallback(code: string, memberId: string): Promise<void> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  await prisma.googleToken.upsert({
    where: { memberId },
    create: {
      memberId,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    },
    update: {
      accessToken: tokens.access_token!,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    },
  });
}

/** メンバーの認証済み Calendar クライアントを取得 */
async function getCalendarClient(memberId: string) {
  const token = await prisma.googleToken.findUnique({ where: { memberId } });
  if (!token) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  // トークン自動更新時に DB へ保存
  client.on("tokens", async (newTokens) => {
    await prisma.googleToken.update({
      where: { memberId },
      data: {
        accessToken: newTokens.access_token ?? token.accessToken,
        expiresAt: new Date(newTokens.expiry_date ?? Date.now() + 3600_000),
      },
    });
  });

  return google.calendar({ version: "v3", auth: client });
}

const LOCATION_JA: Record<string, string> = {
  office: "出社",
  remote: "リモート",
  online: "オンライン",
  client_site: "客先",
};

/** 勤務予定を Google Calendar に同期（fire-and-forget 用） */
export async function syncSchedulesToCalendar(
  memberId: string,
  schedules: Array<{
    date: string;
    startTime: string | null;
    endTime: string | null;
    isOff: boolean;
    locationType: string;
  }>,
): Promise<void> {
  const calendar = await getCalendarClient(memberId);
  if (!calendar) return;

  for (const s of schedules) {
    if (s.isOff || !s.startTime || !s.endTime) continue;

    const loc = LOCATION_JA[s.locationType] ?? s.locationType;
    const summary = `勤務 ${s.startTime}-${s.endTime} (${loc})`;
    const startDT = `${s.date}T${s.startTime}:00+09:00`;
    const endDT = `${s.date}T${s.endTime}:00+09:00`;

    try {
      // extendedProperties で既存イベントを検索（重複防止）
      const existing = await calendar.events.list({
        calendarId: "primary",
        privateExtendedProperty: [`opsScheduleDate=${s.date}`],
        timeMin: `${s.date}T00:00:00+09:00`,
        timeMax: `${s.date}T23:59:59+09:00`,
        singleEvents: true,
      });

      const eventBody = {
        summary,
        start: { dateTime: startDT, timeZone: "Asia/Tokyo" },
        end: { dateTime: endDT, timeZone: "Asia/Tokyo" },
        extendedProperties: {
          private: { opsScheduleDate: s.date, source: "integrated-ops-system" },
        },
      };

      const existingEvent = existing?.data?.items?.[0];
      if (existingEvent?.id) {
        await calendar.events.update({
          calendarId: "primary",
          eventId: existingEvent.id,
          requestBody: eventBody,
        });
      } else {
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: eventBody,
        });
      }
    } catch (err) {
      console.error(`[GoogleCalendar] Failed to sync ${s.date}:`, err);
    }
  }
}

/** Google 連携を解除 */
export async function disconnect(memberId: string): Promise<void> {
  const token = await prisma.googleToken.findUnique({ where: { memberId } });
  if (!token) return;

  try {
    const client = createOAuth2Client();
    client.setCredentials({ refresh_token: token.refreshToken });
    await client.revokeToken(token.refreshToken);
  } catch {
    // revoke 失敗は無視
  }

  await prisma.googleToken.delete({ where: { memberId } });
}

/** 連携済みか判定 */
export async function isConnected(memberId: string): Promise<boolean> {
  const count = await prisma.googleToken.count({ where: { memberId } });
  return count > 0;
}
