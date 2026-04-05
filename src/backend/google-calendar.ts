import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/backend/db";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

function createOAuth2Client() {
  return new OAuth2Client(
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

/** アクセストークンを取得（期限切れなら自動リフレッシュ） */
async function getAccessToken(memberId: string): Promise<string | null> {
  const token = await prisma.googleToken.findUnique({ where: { memberId } });
  if (!token) return null;

  // まだ有効なら返す
  if (token.expiresAt.getTime() > Date.now() + 60_000) {
    return token.accessToken;
  }

  // リフレッシュ
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: token.refreshToken });
  const { credentials } = await client.refreshAccessToken();

  await prisma.googleToken.update({
    where: { memberId },
    data: {
      accessToken: credentials.access_token ?? token.accessToken,
      expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
    },
  });

  return credentials.access_token ?? token.accessToken;
}

/** Google Calendar REST API を呼ぶヘルパー */
async function calFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API ${res.status}: ${text}`);
  }
  return res.json();
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
  const accessToken = await getAccessToken(memberId);
  if (!accessToken) return;

  for (const s of schedules) {
    if (s.isOff || !s.startTime || !s.endTime) continue;

    const loc = LOCATION_JA[s.locationType] ?? s.locationType;
    const summary = `勤務 ${s.startTime}-${s.endTime} (${loc})`;
    const startDT = `${s.date}T${s.startTime}:00+09:00`;
    const endDT = `${s.date}T${s.endTime}:00+09:00`;

    try {
      // extendedProperties で既存イベントを検索（重複防止）
      const params = new URLSearchParams({
        privateExtendedProperty: `opsScheduleDate=${s.date}`,
        timeMin: `${s.date}T00:00:00+09:00`,
        timeMax: `${s.date}T23:59:59+09:00`,
        singleEvents: "true",
      });
      const listRes = await calFetch(accessToken, `/calendars/primary/events?${params}`);

      const eventBody = {
        summary,
        start: { dateTime: startDT, timeZone: "Asia/Tokyo" },
        end: { dateTime: endDT, timeZone: "Asia/Tokyo" },
        extendedProperties: {
          private: { opsScheduleDate: s.date, source: "integrated-ops-system" },
        },
      };

      const existingEvent = listRes.items?.[0];
      if (existingEvent?.id) {
        await calFetch(accessToken, `/calendars/primary/events/${existingEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(eventBody),
        });
      } else {
        await calFetch(accessToken, `/calendars/primary/events`, {
          method: "POST",
          body: JSON.stringify(eventBody),
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
    await fetch(`https://oauth2.googleapis.com/revoke?token=${token.refreshToken}`, {
      method: "POST",
    });
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
