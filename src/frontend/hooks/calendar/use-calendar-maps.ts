import { useMemo } from "react";
import { COLORS } from "@/frontend/constants/calendar";
import type { CalData, AttEntry, SchedEntry } from "@/shared/types/calendar";

/** カレンダービュー共通: メンバー色、勤怠Map、予定Map を生成 */
export function useCalendarMaps(calData: CalData, myMemberId?: string | null) {
  const colorMap = useMemo(() => {
    const map = new Map<string, typeof COLORS[number]>();
    if (myMemberId) map.set(myMemberId, COLORS[0]);
    let ci = 1;
    for (const m of calData.members) {
      if (m.id === myMemberId) continue;
      map.set(m.id, COLORS[ci % COLORS.length]);
      ci++;
    }
    return map;
  }, [calData.members, myMemberId]);

  const attMap = useMemo(() => {
    const map = new Map<string, AttEntry>();
    for (const a of calData.attendances) map.set(`${a.memberId}:${a.date}`, a);
    return map;
  }, [calData.attendances]);

  const schedMap = useMemo(() => {
    const map = new Map<string, SchedEntry>();
    for (const s of calData.schedules) map.set(`${s.memberId}:${s.date}`, s);
    return map;
  }, [calData.schedules]);

  return { colorMap, attMap, schedMap };
}
