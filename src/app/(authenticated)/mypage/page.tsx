"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  User, Mail, Phone, Calendar, Bell, Shield,
  Award, Pencil, MapPin, CreditCard, Star,
  ChevronDown, ChevronUp, Clock, Briefcase,
} from "lucide-react";
import { useAuth } from "@/frontend/contexts/auth-context";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Badge } from "@/frontend/components/common/badge";
import { Button } from "@/frontend/components/common/button";
import { formatDate } from "@/shared/utils";
import type { TodayAttendance, MyPageSummaryResponse } from "@/shared/types/mypage";
import { roleLabel } from "@/frontend/constants/common";
import { ProfileEditModal } from "@/frontend/components/domain/mypage/profile-edit-modal";
import { PasswordChangeModal } from "@/frontend/components/domain/mypage/password-change-modal";
import { TodayAttendanceCard } from "@/frontend/components/domain/mypage/today-attendance-card";
import { MyPageSkeleton } from "@/frontend/components/common/skeleton";
import { EVALUATION_AXES, type ScoreGrade } from "@/shared/constants/evaluation-taxonomy";
import { AvgBadge, GradeBadge, avgToGradeLabel } from "@/frontend/components/domain/evaluation/evaluation-score-display";
import { Select } from "@/frontend/components/common/input";

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  actualHours: number | null;
  status: string;
  confirmStatus: string;
}

const TABS = [
  { key: "attendance", label: "勤怠", icon: Clock },
  { key: "profile", label: "プロフィール", icon: User },
  { key: "billing", label: "請求書情報", icon: CreditCard },
  { key: "evaluation", label: "評価・スキル", icon: Award },
  { key: "settings", label: "設定", icon: Shield },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  done: { label: "退勤済", color: "text-green-700 bg-green-50" },
  working: { label: "勤務中", color: "text-blue-700 bg-blue-50" },
  absent: { label: "欠勤", color: "text-red-700 bg-red-50" },
  pending_approval: { label: "承認待ち", color: "text-amber-700 bg-amber-50" },
  not_started: { label: "未出勤", color: "text-slate-500 bg-slate-50" },
};

export default function MyPage() {
  const { memberId, role } = useAuth();
  const [tab, setTab] = useState<TabKey>("attendance");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingBilling, setEditingBilling] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [evalMonth, setEvalMonth] = useState<string>("");
  const [expandedEvalId, setExpandedEvalId] = useState<string | null>(null);

  // 当月 YYYY-MM
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [attMonth, setAttMonth] = useState(currentMonth);

  const { data: summaryData, isLoading: mypageLoading, mutate: mutateMypage } = useSWR<MyPageSummaryResponse | null>(
    memberId ? "/api/mypage-summary" : null
  );

  useSWR<TodayAttendance | null>("/api/attendances/today");

  // 勤怠一覧
  const { data: attendances = [], isLoading: attLoading } = useSWR<AttendanceRecord[]>(
    memberId ? `/api/attendances?month=${attMonth}` : null
  );

  const evaluations = summaryData?.evaluations ?? [];
  const evalMonths = Array.from(new Set(evaluations.map((ev) => ev.targetPeriod))).sort().reverse();
  const filteredEvals = evalMonth ? evaluations.filter((ev) => ev.targetPeriod === evalMonth) : evaluations;
  const skillAssessment = summaryData?.skillAssessment ?? null;

  const memberDetail = summaryData?.member ?? null;
  const myProjects = memberDetail?.projects ?? [];
  const hasBankInfo = memberDetail?.bankName || memberDetail?.bankAccountNumber;

  // 勤怠月選択肢（過去6ヶ月）
  const attMonthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">マイページ</h1>
        <p className="text-sm text-slate-500">{memberDetail?.name ?? ""}</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ─── 勤怠タブ ─── */}
      {tab === "attendance" && (
        <div className="space-y-4">
          <TodayAttendanceCard />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>勤怠一覧</CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={attMonth}
                    onChange={(e) => setAttMonth(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  >
                    {attMonthOptions.map((m) => (
                      <option key={m} value={m}>{m.replace("-", "年")}月</option>
                    ))}
                  </Select>
                  <Link
                    href="/attendance"
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    打刻画面
                  </Link>
                </div>
              </div>
            </CardHeader>
            {attLoading ? (
              <p className="text-sm text-slate-400">読み込み中...</p>
            ) : attendances.length === 0 ? (
              <p className="text-sm text-slate-400">{attMonth.replace("-", "年")}月の勤怠データがありません</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">日付</th>
                      <th className="px-3 py-2 text-left font-medium">出勤</th>
                      <th className="px-3 py-2 text-left font-medium">退勤</th>
                      <th className="px-3 py-2 text-right font-medium">休憩</th>
                      <th className="px-3 py-2 text-right font-medium">実働</th>
                      <th className="px-3 py-2 text-center font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendances.map((att) => {
                      const st = STATUS_LABEL[att.status] ?? STATUS_LABEL.not_started;
                      return (
                        <tr key={att.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{att.date}</td>
                          <td className="px-3 py-2 text-slate-600">{att.clockIn ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{att.clockOut ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{att.breakMinutes}分</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-700">
                            {att.actualHours != null ? `${att.actualHours}h` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── プロフィールタブ ─── */}
      {tab === "profile" && (mypageLoading || !memberDetail ? (
        <MyPageSkeleton />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>プロフィール</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                  <Pencil size={13} /> 編集
                </Button>
              </div>
            </CardHeader>
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600 shrink-0">
                {memberDetail.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-800">{memberDetail.name}</h2>
                  <Badge variant="default">{roleLabel[role ?? "member"]}</Badge>
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
              {memberDetail.address && (
                <div className="flex items-start gap-2 text-sm text-slate-600 sm:col-span-2">
                  <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  {memberDetail.address}
                </div>
              )}
            </div>
          </Card>

          {/* 担当プロジェクト */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Briefcase size={15} className="inline mr-1" />
                担当プロジェクト
              </CardTitle>
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
        </div>
      ))}

      {/* ─── 請求書情報タブ ─── */}
      {tab === "billing" && (mypageLoading || !memberDetail ? (
        <MyPageSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <CreditCard size={15} className="inline mr-1" />
                請求書情報（口座）
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditingBilling(true)}>
                <Pencil size={13} /> 編集
              </Button>
            </div>
          </CardHeader>
          {hasBankInfo ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">銀行名</p>
                  <p className="font-medium text-slate-800">{memberDetail.bankName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">支店名</p>
                  <p className="font-medium text-slate-800">{memberDetail.bankBranch ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">口座番号</p>
                  <p className="font-medium text-slate-800">
                    {memberDetail.bankAccountNumber
                      ? `****${memberDetail.bankAccountNumber.slice(-4)}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">口座名義</p>
                  <p className="font-medium text-slate-800">{memberDetail.bankAccountHolder ?? "—"}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <CreditCard size={15} className="shrink-0" />
              <span>口座情報が未登録です。「編集」から登録してください。登録すると請求書に自動挿入されます。</span>
            </div>
          )}
        </Card>
      ))}

      {/* ─── 評価・スキルタブ ─── */}
      {tab === "evaluation" && (mypageLoading ? (
        <MyPageSkeleton />
      ) : (
        <div className="space-y-4">
          {/* スキル */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Star size={15} className="inline mr-1" />
                スキル
              </CardTitle>
            </CardHeader>
            {!skillAssessment ? (
              <p className="text-sm text-slate-500">スキル評価がまだ登録されていません。</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">対象月: {skillAssessment.targetPeriod.replace("-", "年")}月</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {EVALUATION_AXES.map((axis) => (
                    <div key={axis.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">
                          {axis.id}. {axis.label}
                        </p>
                        <AvgBadge avg={skillAssessment.axisAverages[axis.key] ?? null} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {axis.subCategories.flatMap((sc) =>
                          sc.items.map((item) => {
                            const grade = (skillAssessment.scores[item.id] as ScoreGrade) ?? null;
                            return (
                              <div key={item.id} title={item.label} className="flex items-center gap-0.5">
                                <span className="text-[10px] text-slate-400">{item.id}</span>
                                <GradeBadge grade={grade} />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">総合</span>
                  <span className="font-semibold text-blue-700">
                    {skillAssessment.totalAvg != null ? avgToGradeLabel(skillAssessment.totalAvg) : "—"}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* 人事評価 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Award size={15} className="inline mr-1" />
                  人事評価
                </CardTitle>
                {evalMonths.length > 0 && (
                  <Select
                    value={evalMonth}
                    onChange={(e) => { setEvalMonth(e.target.value); setExpandedEvalId(null); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none"
                  >
                    <option value="">全期間</option>
                    {evalMonths.map((m) => (
                      <option key={m} value={m}>{m.replace("-", "年")}月</option>
                    ))}
                  </Select>
                )}
              </div>
            </CardHeader>
            {evaluations.length === 0 ? (
              <p className="text-sm text-slate-500">人事評価の記録がまだありません。</p>
            ) : (
              <div className="space-y-3">
                {filteredEvals.map((ev) => {
                  const isExpanded = expandedEvalId === ev.id;
                  return (
                    <div key={ev.id} className="rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="text-sm font-medium text-slate-800 min-w-[80px]">
                          {ev.targetPeriod.replace("-", "年")}月
                        </span>
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          {EVALUATION_AXES.map((axis) => (
                            <div key={axis.id} className="flex items-center gap-1 text-xs">
                              <span className="text-slate-400">{axis.id}.</span>
                              <AvgBadge avg={ev.axisAverages[axis.key] ?? null} />
                            </div>
                          ))}
                          <div className="flex items-center gap-1 text-xs ml-1">
                            <span className="text-slate-500 font-medium">総合:</span>
                            <span className="font-semibold text-blue-700">
                              {ev.totalAvg != null ? avgToGradeLabel(ev.totalAvg) : "—"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedEvalId(isExpanded ? null : ev.id)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                        >
                          詳細
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>

                      {ev.comment && (
                        <div className="mx-4 mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm">
                          <p className="text-xs text-blue-600 font-medium mb-0.5">コメント</p>
                          <p className="text-slate-700">{ev.comment}</p>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                          {EVALUATION_AXES.map((axis) => (
                            <div key={axis.id}>
                              <p className="text-xs font-semibold text-slate-600 mb-1.5">
                                {axis.id}. {axis.label}
                              </p>
                              {axis.subCategories.map((sc) => (
                                <div key={sc.id} className="mb-2">
                                  <p className="text-[10px] text-slate-400 mb-1">{sc.label}</p>
                                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                                    {sc.items.map((item) => {
                                      const grade = (ev.scores[item.id] as ScoreGrade) ?? null;
                                      return (
                                        <div key={item.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                                          <span className="text-xs text-slate-600 truncate mr-1">{item.label}</span>
                                          <GradeBadge grade={grade} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      ))}

      {/* ─── 設定タブ ─── */}
      {tab === "settings" && (
        <div className="space-y-4">
          <NotificationSettingsCard />

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
                  <p className="text-xs text-slate-500">定期的なパスワード変更を推奨します</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                  変更する
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── プロフィール編集モーダル ─── */}
      {editingProfile && memberDetail && (
        <ProfileEditModal
          memberId={memberDetail.id}
          current={memberDetail}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => {
            mutateMypage((prev) => prev ? { ...prev, member: { ...prev.member, ...updated } } : prev, false);
          }}
          mode="profile"
        />
      )}

      {/* ─── 請求書情報編集モーダル ─── */}
      {editingBilling && memberDetail && (
        <ProfileEditModal
          memberId={memberDetail.id}
          current={memberDetail}
          onClose={() => setEditingBilling(false)}
          onSaved={(updated) => {
            mutateMypage((prev) => prev ? { ...prev, member: { ...prev.member, ...updated } } : prev, false);
          }}
          mode="billing"
        />
      )}

      {/* ─── パスワード変更モーダル ─── */}
      {changingPassword && memberDetail && (
        <PasswordChangeModal
          memberId={memberDetail.id}
          onClose={() => setChangingPassword(false)}
        />
      )}
    </div>
  );
}

// ─── 通知設定カード ───
interface NotifSettings {
  clockReminder: boolean;
  closingReminder: boolean;
  scheduleReminder: boolean;
}

const NOTIF_ITEMS: { key: keyof NotifSettings; label: string; desc: string }[] = [
  { key: "clockReminder", label: "打刻リマインド", desc: "平日10時に出勤打刻忘れをSlack/メールで通知" },
  { key: "closingReminder", label: "締めリマインド", desc: "毎月25日に請求書・工数申告の提出リマインド" },
  { key: "scheduleReminder", label: "勤務予定リマインド", desc: "毎週土曜に翌週の勤務予定登録リマインド" },
];

function NotificationSettingsCard() {
  const { data, mutate } = useSWR<NotifSettings>("/api/notification-settings");

  async function toggle(key: keyof NotifSettings) {
    if (!data) return;
    const updated = { ...data, [key]: !data[key] };
    mutate(updated, false);
    await fetch("/api/notification-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: !data[key] }),
    });
    mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Bell size={16} className="inline mr-1" />
          通知設定
        </CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {NOTIF_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{item.label}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                data?.[item.key] ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  data?.[item.key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
