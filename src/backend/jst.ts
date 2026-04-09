/** JST (UTC+9) のユーティリティ。サーバー側で使用。 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC Date → JST の "HH:MM" 文字列 */
export function toTimeStr(dt: Date | null): string | null {
  if (!dt) return null;
  const jst = new Date(dt.getTime() + JST_OFFSET_MS);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

/** JST の "HH:MM" 文字列 → UTC Date に変換。baseDate は UTC midnight。 */
export function parseTimeOnDate(baseDate: Date, timeStr: string | null): Date | null {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [h, m] = timeStr.split(":").map(Number);
  // baseDate(UTC midnight) - 9h = JST midnight(UTC表現)
  // JST midnight + ユーザー入力h:m = UTC での実際の時刻
  const jstMidnightMs = baseDate.getTime() - JST_OFFSET_MS;
  return new Date(jstMidnightMs + h * 60 * 60 * 1000 + m * 60 * 1000);
}

/** 現在時刻を JST の Date として返す（getUTC* で JST の値が取れる） */
export function jstNow(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

/** "YYYY-MM-DD" → UTC midnight の Date。TZ を明示して環境依存を排除。 */
export function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}
