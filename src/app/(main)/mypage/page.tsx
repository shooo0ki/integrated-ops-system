"use client";

import { useState, useEffect } from "react";
import {
  User, Mail, Phone, Calendar, Bell, Shield, ClipboardList, CheckCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, buildMonths } from "@/lib/utils";

const TARGET_MONTH = buildMonths(1)[0];

const roleLabel: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  employee: "社員",
  intern: "インターン",
};

interface MemberDetail {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  company: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  email: string;
  role: string;
  skills: { id: string; skillId: string; skillName: string; categoryName: string; level: number }[];
}

interface TodayAttendance {
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  status: string;
}

interface MyProject {
  projectId: string;
  projectName: string;
  role: string;
  workloadHours: number;
}

interface SelfReport {
  projectId: string;
  projectName: string;
  reportedHours: number;
  submittedAt: string | null;
}

export default function MyPage() {
  const { memberId, role } = useAuth();
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [todayAtt, setTodayAtt] = useState<TodayAttendance | null>(null);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [selfReports, setSelfReports] = useState<SelfReport[]>([]);
  const [reportAllocations, setReportAllocations] = useState<{ projectId: string; projectName: string; reportedHours: number }[]>([]);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [notifySlack, setNotifySlack] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    Promise.all([
      fetch(`/api/members/${memberId}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/attendances/today").then((r) => r.ok ? r.json() : null),
      fetch("/api/dashboard").then((r) => r.ok ? r.json() : null),
      fetch(`/api/self-reports?month=${TARGET_MONTH}`).then((r) => r.ok ? r.json() : []),
    ]).then(([detail, att, dash, reports]) => {
      setMemberDetail(detail);
      setTodayAtt(att);
      const projects: MyProject[] = dash?.myProjects ?? [];
      setMyProjects(projects);
      const existing: SelfReport[] = reports ?? [];
      setSelfReports(existing);
      // Init allocation input from existing reports or from projects
      const allocs = projects.map((p) => {
        const found = existing.find((r) => r.projectId === p.projectId);
        return { projectId: p.projectId, projectName: p.projectName, reportedHours: found?.reportedHours ?? 0 };
      });
      setReportAllocations(allocs);
      setReportSubmitted(existing.length > 0 && existing.every((r) => r.submittedAt));
      setLoading(false);
    });
  }, [memberId]);

  async function handleSubmitReport() {
    const res = await fetch("/api/self-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMonth: TARGET_MONTH,
        allocations: reportAllocations.map((a) => ({ projectId: a.projectId, reportedHours: a.reportedHours })),
      }),
    });
    if (res.ok) setReportSubmitted(true);
  }

  const totalReported = reportAllocations.reduce((s, a) => s + a.reportedHours, 0);

  if (loading) return <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>;
  if (!memberDetail) return null;

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
        </CardHeader>
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600 shrink-0">
            {memberDetail.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{memberDetail.name}</h2>
              <Badge variant={memberDetail.company === "boost" ? "boost" : "salt2"}>
                {memberDetail.company === "boost" ? "Boost" : "SALT2"}
              </Badge>
              <Badge variant="default">{roleLabel[role ?? "employee"]}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={14} className="text-slate-400" />
            {memberDetail.email}
          </div>
          {memberDetail.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone size={14} className="text-slate-400" />
              {memberDetail.phone}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            入社日: {formatDate(memberDetail.joinedAt)}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User size={14} className="text-slate-400" />
            {memberDetail.salaryType === "monthly" ? "月給制" : "時給制"}
          </div>
        </div>
      </Card>

      {/* Today's attendance */}
      <Card>
        <CardHeader>
          <CardTitle>本日の勤怠</CardTitle>
        </CardHeader>
        {todayAtt ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">出勤時刻</p>
              <p className="font-medium text-slate-800">{todayAtt.clockIn ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">退勤時刻</p>
              <p className="font-medium text-slate-800">{todayAtt.clockOut ?? (todayAtt.status === "working" ? "勤務中" : "—")}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400">休憩</p>
              <p className="font-medium text-slate-800">{todayAtt.breakMinutes}分</p>
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
            {myProjects.map((pj) => (
              <div key={pj.projectId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-slate-800">{pj.projectName}</span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    役割: {pj.role} | 稼働: {pj.workloadHours}h/月
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Monthly self-report */}
      {myProjects.length > 0 && (
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
              <p className="text-xs text-slate-400 text-right">合計: {totalReported}h</p>
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
                <span className="text-sm text-slate-600">
                  合計: <span className="font-bold text-slate-800">{totalReported}h</span>
                </span>
                <Button variant="primary" size="sm" onClick={handleSubmitReport}>申告する</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Skills summary */}
      {memberDetail.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>スキルサマリー</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {memberDetail.skills.map((skill) => (
              <div key={skill.id} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{skill.categoryName}</p>
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
      )}

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
              <p className="text-xs text-slate-500">認証プロバイダー（Slack / Google）で管理されます</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">二段階認証</p>
              <p className="text-xs text-slate-500">認証プロバイダーの設定をご確認ください</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
