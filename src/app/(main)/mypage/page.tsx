"use client";

import { useState, memo } from "react";
import useSWR from "swr";
import {
  User, Mail, Phone, Calendar, Bell, Shield, ClipboardList, CheckCircle,
  Award, Pencil, ChevronRight, MapPin, CreditCard, Star,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";

const roleLabel: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
};

const levelLabels = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

interface MemberDetail {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  status: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  email: string;
  role: string;
  skills: {
    id: string;
    skillId: string;
    skillName: string;
    categoryName: string;
    level: number;
    evaluatedAt: string;
    memo: string | null;
  }[];
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

interface EvalRecord {
  id: string;
  targetPeriod: string;
  scoreP: number;
  scoreA: number;
  scoreS: number;
  totalAvg: number;
  comment: string | null;
}

interface MyPageResponse extends MemberDetail {
  projects: MyProject[];
}

interface MyPageSummaryResponse {
  member: MyPageResponse;
  evaluations: EvalRecord[];
}

// ─── プロフィール編集モーダル ─────────────────────────────

interface ProfileForm {
  email: string;
  phone: string;
  address: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
}

function ProfileEditModal({
  memberId,
  current,
  onClose,
  onSaved,
}: {
  memberId: string;
  current: MemberDetail;
  onClose: () => void;
  onSaved: (updated: Partial<MemberDetail>) => void;
}) {
  const [form, setForm] = useState<ProfileForm>({
    email: current.email ?? "",
    phone: current.phone ?? "",
    address: current.address ?? "",
    bankName: current.bankName ?? "",
    bankBranch: current.bankBranch ?? "",
    bankAccountNumber: current.bankAccountNumber ?? "",
    bankAccountHolder: current.bankAccountHolder ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/members/${memberId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email || undefined,
        phone: form.phone || null,
        address: form.address || null,
        bankName: form.bankName || null,
        bankBranch: form.bankBranch || null,
        bankAccountNumber: form.bankAccountNumber || null,
        bankAccountHolder: form.bankAccountHolder || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      onSaved(data);
      onClose();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err?.error?.message ?? "保存に失敗しました");
    }
    setSaving(false);
  }

  const field = (label: string, key: keyof ProfileForm, placeholder?: string, type: "text" | "email" = "text") => (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title="プロフィール編集" size="md">
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {field("メールアドレス", "email", "例: user@example.com", "email")}

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">連絡先</p>
        {field("電話番号", "phone", "例: 090-1234-5678")}
        {field("住所", "address", "例: 東京都渋谷区...")}

        <p className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">口座情報（請求書に使用）</p>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          口座情報は請求書生成時に自動で挿入されます。正確に入力してください。
        </div>
        {field("銀行名", "bankName", "例: ○○銀行")}
        {field("支店名", "bankBranch", "例: 渋谷支店")}
        {field("口座番号", "bankAccountNumber", "例: 1234567")}
        {field("口座名義（カナ）", "bankAccountHolder", "例: ヤマダ タロウ")}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存する"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── パスワード変更モーダル ────────────────────────────────

function PasswordChangeModal({
  memberId,
  onClose,
}: {
  memberId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSave() {
    if (form.newPassword !== form.confirmPassword) {
      setError("新しいパスワードが一致しません");
      return;
    }
    if (form.newPassword.length < 8) {
      setError("新しいパスワードは8文字以上で入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/members/${memberId}/profile/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    });
    if (res.ok) {
      setDone(true);
      setTimeout(() => onClose(), 1500);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err?.error?.message ?? "パスワード変更に失敗しました");
    }
    setSaving(false);
  }

  return (
    <Modal isOpen onClose={onClose} title="パスワード変更" size="sm">
      <div className="space-y-4">
        {done ? (
          <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-3 text-sm text-green-700">
            <CheckCircle size={15} />
            パスワードを変更しました
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">現在のパスワード</label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">新しいパスワード</label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="8文字以上"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">新しいパスワード（確認）</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={onClose}>キャンセル</Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !form.currentPassword || !form.newPassword || !form.confirmPassword}
              >
                {saving ? "変更中..." : "変更する"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── スコアドット ────────────────────────────────────────

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

// ─── 本日の勤怠カード（SWR独立・再レンダー隔離） ──────────

const TodayAttendanceCard = memo(function TodayAttendanceCard() {
  const { data: todayAtt } = useSWR<TodayAttendance | null>("/api/attendances/today");
  return (
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
  );
});

// ─── Page ─────────────────────────────────────────────────

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

  if (mypageLoading) return <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>;
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

      {/* ─── 勤怠一覧リンク ─── */}
      <a href="/attendance/list" className="block">
        <Card className="transition-colors hover:bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <ClipboardList size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">勤怠一覧・修正依頼</p>
                <p className="text-xs text-slate-500">過去の打刻確認や修正申請</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>
        </Card>
      </a>

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
