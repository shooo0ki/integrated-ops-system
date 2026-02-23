"use client";

import { useState } from "react";
import { User, Mail, Phone, Calendar, Bell, Shield, Edit2, CheckCircle, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getMemberProjects, formatCurrency, formatDate, ATTENDANCE_RECORDS,
  SELF_REPORTS, PROJECTS, type SelfReportAllocation,
} from "@/lib/mock-data";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const roleLabel: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  employee: "社員",
  intern: "インターン",
};

export default function MyPage() {
  const { member, role } = useAuth();
  const [notifySlack, setNotifySlack] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [saved, setSaved] = useState(false);

  // 自己申告 (2026-02 当月) — hooks must be before any early return
  const TARGET_MONTH = "2026-02";
  const selfReport = member
    ? SELF_REPORTS.find((r) => r.memberId === member.id && r.targetMonth === TARGET_MONTH)
    : undefined;
  const activeProjects = member
    ? PROJECTS.filter((p) => p.status === "active" && p.assignments.some((a) => a.memberId === member.id))
    : [];
  const initAllocations: SelfReportAllocation[] = activeProjects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    reportedHours: selfReport?.allocations.find((a) => a.projectId === p.id)?.reportedHours ?? 0,
  }));
  const [reportAllocations, setReportAllocations] = useState<SelfReportAllocation[]>(initAllocations);
  const [reportSubmitted, setReportSubmitted] = useState(selfReport?.status === "submitted");
  const totalReported = reportAllocations.reduce((s, a) => s + a.reportedHours, 0);
  const actualHours = selfReport?.actualHours ?? 0;

  if (!member) return null;

  const myProjects = getMemberProjects(member.id);
  const myAttendance = ATTENDANCE_RECORDS.filter((a) => a.memberId === member.id);
  const todayRecord = myAttendance.find((a) => a.date === "2026-02-20");

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">マイページ</h1>
        <p className="text-sm text-slate-500">アカウント情報と設定</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <Button variant="outline" size="sm">
            <Edit2 size={14} />
            編集（デモ）
          </Button>
        </CardHeader>
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600 shrink-0">
            {member.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{member.name}</h2>
              <Badge variant={member.company === "Boost" ? "boost" : "salt2"}>
                {member.company}
              </Badge>
              <Badge variant="default">{roleLabel[role]}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{member.nameKana}</p>
            <p className="mt-1 text-sm text-slate-600">{member.department} | {member.position}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={14} className="text-slate-400" />
            {member.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone size={14} className="text-slate-400" />
            {member.phone}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            入社日: {formatDate(member.joinDate)}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User size={14} className="text-slate-400" />
            {member.contractType}
            {member.monthlyRate && (
              <span className="text-blue-600 font-medium">{formatCurrency(member.monthlyRate)}/月</span>
            )}
            {member.hourlyRate && (
              <span className="text-blue-600 font-medium">{formatCurrency(member.hourlyRate)}/時</span>
            )}
          </div>
          {member.slackId && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-slate-400">#</span>
              Slack: {member.slackId}
            </div>
          )}
        </div>
      </Card>

      {/* Today's attendance */}
      <Card>
        <CardHeader>
          <CardTitle>本日の勤怠</CardTitle>
        </CardHeader>
        {todayRecord ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">出勤時刻</p>
              <p className="font-medium text-slate-800">{todayRecord.clockIn ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">退勤時刻</p>
              <p className="font-medium text-slate-800">{todayRecord.clockOut ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">休憩</p>
              <p className="font-medium text-slate-800">{todayRecord.breakMinutes}分</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">実働</p>
              <p className="font-medium text-slate-800">
                {todayRecord.actualHours ? `${todayRecord.actualHours}h` : "集計中"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">本日の勤怠データがありません。</p>
        )}
      </Card>

      {/* My projects */}
      <Card>
        <CardHeader>
          <CardTitle>担当プロジェクト</CardTitle>
        </CardHeader>
        {myProjects.length === 0 ? (
          <p className="text-sm text-slate-500">担当プロジェクトはありません。</p>
        ) : (
          <div className="space-y-2">
            {myProjects.map((pj) => {
              const assign = pj.assignments.find((a) => a.memberId === member.id);
              return (
                <div key={pj.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={pj.company === "Boost" ? "boost" : "salt2"}>{pj.company}</Badge>
                      <span className="text-sm font-medium text-slate-800">{pj.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      役割: {assign?.role} | 稼働: {assign?.monthlyHours}h/月
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Monthly self-report */}
      {activeProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <ClipboardList size={16} className="inline mr-1" />
              月次工数自己申告（{TARGET_MONTH.replace("-", "年")}月）
            </CardTitle>
          </CardHeader>
          {reportSubmitted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
                <CheckCircle size={15} className="text-green-600" />
                <span className="text-sm text-green-700 font-medium">申告済み</span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr className="text-xs text-slate-500">
                    <th className="py-2 text-left font-medium">プロジェクト</th>
                    <th className="py-2 text-right font-medium">申告時間</th>
                  </tr>
                </thead>
                <tbody>
                  {reportAllocations.map((a) => (
                    <tr key={a.projectId} className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">{a.projectName}</td>
                      <td className="py-2 text-right font-medium text-slate-800">{a.reportedHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 text-right">合計: {totalReported}h / 打刻実績: {actualHours}h</p>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setReportSubmitted(false)}>修正する</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">各プロジェクトに割いた時間を概算で入力してください。</p>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr className="text-xs text-slate-500">
                    <th className="py-2 text-left font-medium">プロジェクト</th>
                    <th className="py-2 text-right font-medium">時間（h）</th>
                  </tr>
                </thead>
                <tbody>
                  {reportAllocations.map((a, i) => (
                    <tr key={a.projectId} className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">{a.projectName}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={a.reportedHours}
                          onChange={(e) => {
                            const next = [...reportAllocations];
                            next[i] = { ...next[i], reportedHours: Number(e.target.value) };
                            setReportAllocations(next);
                          }}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  合計: <span className={`font-bold ${Math.abs(totalReported - actualHours) > 8 ? "text-amber-600" : "text-slate-800"}`}>{totalReported}h</span>
                  <span className="ml-2 text-xs text-slate-400">（打刻実績: {actualHours}h）</span>
                  {Math.abs(totalReported - actualHours) > 8 && (
                    <span className="ml-2 text-xs text-amber-600">※ 実績との差が大きいです</span>
                  )}
                </div>
                <Button variant="primary" size="sm" onClick={() => setReportSubmitted(true)}>申告する</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Skills summary */}
      <Card>
        <CardHeader>
          <CardTitle>スキルサマリー</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {member.skills.map((skill) => (
            <div key={skill.skillId} className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{skill.category}</p>
              <p className="text-sm font-medium text-slate-800">{skill.skillName}</p>
              <div className="mt-0.5 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 w-4 rounded-full ${n <= skill.level ? "bg-blue-500" : "bg-slate-200"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Notification settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Bell size={16} className="inline mr-1" />
            通知設定
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-800">Slack通知</p>
              <p className="text-xs text-slate-500">打刻リマインダーをSlackで受け取る</p>
            </div>
            <button
              onClick={() => setNotifySlack(!notifySlack)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifySlack ? "bg-blue-600" : "bg-slate-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifySlack ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-800">メール通知</p>
              <p className="text-xs text-slate-500">月次締めのリマインダーをメールで受け取る</p>
            </div>
            <button
              onClick={() => setNotifyEmail(!notifyEmail)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyEmail ? "bg-blue-600" : "bg-slate-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifyEmail ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> 保存しました（デモ）
            </span>
          )}
          <Button variant="primary" size="sm" onClick={handleSave}>保存</Button>
        </div>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Shield size={16} className="inline mr-1" />
            セキュリティ
          </CardTitle>
        </CardHeader>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">パスワード変更</p>
              <p className="text-xs text-slate-500">最終変更: 2025年12月1日</p>
            </div>
            <Button variant="outline" size="sm">変更（デモ）</Button>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">二段階認証</p>
              <p className="text-xs text-slate-500">現在: 無効</p>
            </div>
            <Button variant="outline" size="sm">設定（デモ）</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
