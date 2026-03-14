"use client";

import { getWeeklySchedule } from "@/lib/mock-data";

interface WeeklyScheduleProps {
  memberId: string;
  memberName: string;
}

export function WeeklyScheduleCard({ memberId, memberName }: WeeklyScheduleProps) {
  const schedule = getWeeklySchedule(memberId);

  if (!schedule) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-800">今週のスケジュール</h3>
        <p className="text-sm text-slate-500">スケジュールデータがありません。</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-slate-800">今週のスケジュール（{memberName}）</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {schedule.week.map((d) => (
                <th key={d.date} className="pb-2 text-center text-xs font-medium text-slate-500 min-w-[80px]">
                  <span className={d.date === "2026-02-20" ? "text-blue-600 font-bold" : ""}>
                    {d.dayLabel}
                  </span>
                  <br />
                  <span className="text-slate-400 font-normal">{d.date.slice(5).replace("-", "/")}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {schedule.week.map((d) => (
                <td key={d.date} className="px-1 pt-2 align-top text-center">
                  {d.status === "holiday" ? (
                    <div className="rounded bg-slate-50 px-2 py-2">
                      <p className="text-xs text-slate-300">休</p>
                    </div>
                  ) : d.status === "missing" ? (
                    <div className="rounded bg-amber-100 px-2 py-2">
                      <p className="text-xs font-semibold text-amber-700">打刻漏れ</p>
                      {d.planned && (
                        <p className="mt-0.5 text-xs text-amber-600">
                          {d.planned.start}〜{d.planned.end}
                        </p>
                      )}
                    </div>
                  ) : d.status === "actual" ? (
                    <div className="rounded bg-green-100 px-2 py-2">
                      <p className="text-xs font-semibold text-green-700">実績</p>
                      {d.actual && (
                        <p className="mt-0.5 text-xs text-green-600">
                          {d.actual.start}〜{d.actual.end}
                        </p>
                      )}
                      {d.projectName && (
                        <p className="mt-0.5 truncate text-xs text-green-500">{d.projectName}</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded bg-slate-100 px-2 py-2">
                      <p className="text-xs font-medium text-slate-600">予定</p>
                      {d.planned && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {d.planned.start}〜{d.planned.end}
                        </p>
                      )}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-200" /> 予定</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-200" /> 実績</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200" /> 打刻漏れ</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-50 border" /> 休日</span>
      </div>
    </div>
  );
}
