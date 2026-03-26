"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  User, Mail, Phone, Calendar, Bell, Shield,
  Award, Pencil, ChevronRight, MapPin, CreditCard, Star,
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

const levelLabels = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

function ScoreDot({ score }: { score: number }) {
  const color =
    score >= 4 ? "bg-green-500" :
    score >= 3 ? "bg-blue-500" :
    "bg-amber-400";
  return (
    <span className="inline-flex items-center justify-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-slate-700">{score}</span>
    </span>
  );
}

export default function MyPage() {
  const { memberId, role } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: summaryData, isLoading: mypageLoading, mutate: mutateMypage } = useSWR<MyPageSummaryResponse | null>(
    memberId ? "/api/mypage-summary" : null
  );

  useSWR<TodayAttendance | null>("/api/attendances/today");

  const evaluations = summaryData?.evaluations ?? [];
  const evaluationComments = evaluations.filter((ev) => ev.comment).slice(0, 3);

  if (mypageLoading) return <MyPageSkeleton />;
  const memberDetail = summaryData?.member ?? null;
  if (!memberDetail) return null;

  const myProjects = memberDetail.projects ?? [];
  const hasBankInfo = memberDetail.bankName || memberDetail.bankAccountNumber;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">マイページ</h1>
        <p className="text-sm text-slate-500">アカウント情報と設定</p>
      </div>

      {/* ─── プロフィール ─── */}
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

      {/* ─── 住所・口座情報 ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <CreditCard size={15} className="inline mr-1" />
              請求書情報（住所・口座）
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
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

      {/* ─── 本日の勤怠（SWR独立） ─── */}
      <TodayAttendanceCard />

      {/* ─── スキル ─── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Star size={15} className="inline mr-1" />
            スキル
          </CardTitle>
        </CardHeader>
        {memberDetail.skills.length === 0 ? (
          <p className="text-sm text-slate-500">スキル評価がまだ登録されていません。</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {memberDetail.skills.map((skill) => (
              <div key={skill.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">{skill.categoryName}</p>
                    <p className="text-sm font-medium text-slate-800">{skill.skillName}</p>
                  </div>
                  <span className="text-xs text-amber-500 font-medium">{levelLabels[skill.level]}</span>
                </div>
                <div className="mt-1.5 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className={`h-1.5 flex-1 rounded-full ${n <= skill.level ? "bg-blue-500" : "bg-slate-200"}`}
                    />
                  ))}
                </div>
                {skill.memo && (
                  <p className="mt-1 text-xs text-slate-400 truncate">{skill.memo}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-300">評価日: {formatDate(skill.evaluatedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── 人事評価（PAS） ─── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Award size={15} className="inline mr-1" />
            人事評価（PAS）
          </CardTitle>
        </CardHeader>
        {evaluations.length === 0 ? (
          <p className="text-sm text-slate-500">人事評価の記録がまだありません。</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr className="text-xs text-slate-500">
                    <th className="py-2 text-left font-medium">対象期間</th>
                    <th className="py-2 text-center font-medium">P点<br /><span className="font-normal text-slate-400">Professional</span></th>
                    <th className="py-2 text-center font-medium">A点<br /><span className="font-normal text-slate-400">Appearance</span></th>
                    <th className="py-2 text-center font-medium">S点<br /><span className="font-normal text-slate-400">Skill</span></th>
                    <th className="py-2 text-center font-medium">平均</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((ev) => (
                    <tr key={ev.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-800">
                        {ev.targetPeriod.replace("-", "年")}月
                      </td>
                      <td className="py-2 text-center">
                        <ScoreDot score={ev.scoreP} />
                      </td>
                      <td className="py-2 text-center">
                        <ScoreDot score={ev.scoreA} />
                      </td>
                      <td className="py-2 text-center">
                        <ScoreDot score={ev.scoreS} />
                      </td>
                      <td className="py-2 text-center font-semibold text-blue-700">
                        {ev.totalAvg.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {evaluationComments.length > 0 && (
              <div className="mt-3 space-y-2">
                {evaluationComments.map((ev) => (
                  <div key={ev.id} className="rounded-md bg-blue-50 px-3 py-2 text-sm">
                    <p className="text-xs text-blue-600 font-medium mb-0.5">{ev.targetPeriod.replace("-", "年")}月 コメント</p>
                    <p className="text-slate-700">{ev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* ─── 担当プロジェクト ─── */}
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

      {/* ─── 月次申告リンク ─── */}
      <a href="/closing" className="block">
        <Card className="transition-colors hover:bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <ClipboardList size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">月次工数申告</p>
                <p className="text-xs text-slate-500">請求管理から工数配分を申告</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>
        </Card>
      </a>

      {/* ─── 通知設定 ─── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Bell size={16} className="inline mr-1" />
            通知設定
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Slack通知</p>
              <p className="text-xs text-slate-500">打刻リマインダーをSlackで受け取る</p>
            </div>
            <span className="text-xs text-slate-400">準備中</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">メール通知</p>
              <p className="text-xs text-slate-500">月次締めのリマインダーをメールで受け取る</p>
            </div>
            <span className="text-xs text-slate-400">準備中</span>
          </div>
        </div>
      </Card>

      {/* ─── セキュリティ ─── */}
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

      {/* ─── プロフィール編集モーダル ─── */}
      {editingProfile && (
        <ProfileEditModal
          memberId={memberDetail.id}
          current={memberDetail}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => {
            mutateMypage((prev) => prev ? { ...prev, member: { ...prev.member, ...updated } } : prev, false);
          }}
        />
      )}

      {/* ─── パスワード変更モーダル ─── */}
      {changingPassword && (
        <PasswordChangeModal
          memberId={memberDetail.id}
          onClose={() => setChangingPassword(false)}
        />
      )}
    </div>
  );
}
