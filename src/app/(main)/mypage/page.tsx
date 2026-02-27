"use client";

import { useState, useEffect } from "react";
import {
  User, Mail, Phone, Calendar, Bell, Shield, ClipboardList, CheckCircle,
  Award, Pencil, ChevronLeft, ChevronRight, MapPin, CreditCard, Star,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate, buildMonths } from "@/lib/utils";

const MONTHS = buildMonths(12); // 直近12ヶ月

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

interface SelfReport {
  projectId: string;
  projectName: string;
  reportedHours: number;
  submittedAt: string | null;
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

interface AttRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  actualHours: number | null;
  status: string;
  confirmStatus: string;
  isModified: boolean;
}

// ─── プロフィール編集モーダル ─────────────────────────────

interface ProfileForm {
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

  const field = (label: string, key: keyof ProfileForm, placeholder?: string) => (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
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

// ─── Page ─────────────────────────────────────────────────

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
  const [evaluations, setEvaluations] = useState<EvalRecord[]>([]);
  const [attendances, setAttendances] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [attMonth, setAttMonth] = useState(MONTHS[0]);
  const [attLoading, setAttLoading] = useState(false);

  // プロフィール編集モーダル
  const [editingProfile, setEditingProfile] = useState(false);

  // パスワード変更モーダル
  const [changingPassword, setChangingPassword] = useState(false);

  // 勤怠修正申請
  const [correctionTarget, setCorrectionTarget] = useState<AttRecord | null>(null);
  const [corrForm, setCorrForm] = useState({ clockIn: "", clockOut: "", breakMinutes: "0" });
  const [correcting, setCorrecting] = useState(false);
  const [corrToast, setCorrToast] = useState<string | null>(null);

  const loadAttendances = async (month: string) => {
    setAttLoading(true);
    const res = await fetch(`/api/attendances?month=${month}`);
    const data = res.ok ? await res.json() : [];
    setAttendances(Array.isArray(data) ? data : []);
    setAttLoading(false);
  };

  useEffect(() => {
    if (!memberId) return;
    Promise.all([
      fetch(`/api/members/${memberId}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/attendances/today").then((r) => r.ok ? r.json() : null),
      fetch("/api/dashboard").then((r) => r.ok ? r.json() : null),
      fetch(`/api/self-reports?month=${MONTHS[0]}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/evaluations/${memberId}?limit=6`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/attendances?month=${MONTHS[0]}`).then((r) => r.ok ? r.json() : []),
    ]).then(([detail, att, dash, reports, evals, atts]) => {
      setMemberDetail(detail);
      setTodayAtt(att);
      const projects: MyProject[] = dash?.myProjects ?? [];
      setMyProjects(projects);
      const existing: SelfReport[] = reports ?? [];
      setSelfReports(existing);
      const allocs = projects.map((p) => {
        const found = existing.find((r) => r.projectId === p.projectId);
        return { projectId: p.projectId, projectName: p.projectName, reportedHours: found?.reportedHours ?? 0 };
      });
      setReportAllocations(allocs);
      setReportSubmitted(existing.length > 0 && existing.every((r) => r.submittedAt));
      setEvaluations(Array.isArray(evals) ? evals : []);
      setAttendances(Array.isArray(atts) ? atts : []);
      setLoading(false);
    });
  }, [memberId]);

  async function handleSubmitReport() {
    const res = await fetch("/api/self-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMonth: MONTHS[0],
        allocations: reportAllocations.map((a) => ({ projectId: a.projectId, reportedHours: a.reportedHours })),
      }),
    });
    if (res.ok) setReportSubmitted(true);
  }

  function openCorrection(a: AttRecord) {
    setCorrectionTarget(a);
    setCorrForm({
      clockIn: a.clockIn ?? "",
      clockOut: a.clockOut ?? "",
      breakMinutes: "0",
    });
  }

  async function handleCorrection() {
    if (!correctionTarget) return;
    setCorrecting(true);
    const res = await fetch(`/api/attendances/${correctionTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clockIn: corrForm.clockIn || null,
        clockOut: corrForm.clockOut || null,
        breakMinutes: Number(corrForm.breakMinutes),
      }),
    });
    if (res.ok) {
      setCorrectionTarget(null);
      await loadAttendances(attMonth);
      setCorrToast("修正申請を送信しました。管理者の承認をお待ちください。");
      setTimeout(() => setCorrToast(null), 4000);
    } else {
      const err = await res.json();
      setCorrToast(`エラー: ${err.error?.message ?? "申請失敗"}`);
      setTimeout(() => setCorrToast(null), 4000);
    }
    setCorrecting(false);
  }

  useEffect(() => {
    if (!memberId || loading) return;
    loadAttendances(attMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attMonth, memberId]);

  function prevAttMonth() {
    const idx = MONTHS.indexOf(attMonth);
    if (idx < MONTHS.length - 1) setAttMonth(MONTHS[idx + 1]); // idx+1 = 古い月
  }
  function nextAttMonth() {
    const idx = MONTHS.indexOf(attMonth);
    if (idx > 0) setAttMonth(MONTHS[idx - 1]); // idx-1 = 新しい月
  }

  const totalReported = reportAllocations.reduce((s, a) => s + a.reportedHours, 0);

  // 勤怠サマリー計算
  const attWorkDays = attendances.filter((a) => a.actualHours != null && a.actualHours > 0).length;
  const attTotalHours = attendances.reduce((s, a) => s + (a.actualHours ?? 0), 0);

  if (loading) return <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>;
  if (!memberDetail) return null;

  const hasBankInfo = memberDetail.bankName || memberDetail.bankAccountNumber;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toast */}
      {corrToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm text-white shadow-lg">
          <CheckCircle size={15} className="text-green-400" />
          {corrToast}
        </div>
      )}

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

      {/* ─── 本日の勤怠 ─── */}
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
          <>
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
          </>
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
            {evaluations.some((ev) => ev.comment) && (
              <div className="mt-3 space-y-2">
                {evaluations.filter((ev) => ev.comment).slice(0, 3).map((ev) => (
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

      {/* ─── 月次工数自己申告 ─── */}
      {myProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <ClipboardList size={16} className="inline mr-1" />
              月次工数自己申告（{MONTHS[0].replace("-", "年")}月）
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

      {/* ─── 勤怠記録 ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <ClipboardList size={16} className="inline mr-1" />
              勤怠記録
            </CardTitle>
            <div className="flex items-center gap-1">
              <button onClick={prevAttMonth} disabled={MONTHS.indexOf(attMonth) >= MONTHS.length - 1}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-[80px] text-center text-sm font-medium text-slate-700">
                {attMonth.replace("-", "年")}月
              </span>
              <button onClick={nextAttMonth} disabled={MONTHS.indexOf(attMonth) <= 0}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </CardHeader>
        {attLoading ? (
          <p className="py-4 text-center text-sm text-slate-400">読み込み中...</p>
        ) : attendances.length === 0 ? (
          <p className="text-sm text-slate-500">この月の勤怠データがありません。</p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">稼働日数</p>
                <p className="mt-0.5 text-lg font-bold text-slate-800">{attWorkDays}日</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">合計時間</p>
                <p className="mt-0.5 text-lg font-bold text-slate-800">{attTotalHours.toFixed(1)}h</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-slate-100 bg-white">
                  <tr className="text-xs text-slate-500">
                    <th className="py-2 text-left font-medium">日付</th>
                    <th className="py-2 text-center font-medium">出勤</th>
                    <th className="py-2 text-center font-medium">退勤</th>
                    <th className="py-2 text-right font-medium">実働</th>
                    <th className="py-2 text-right font-medium">状態</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5 text-slate-700">{formatDate(a.date)}</td>
                      <td className="py-1.5 text-center text-slate-600">{a.clockIn ?? "—"}</td>
                      <td className="py-1.5 text-center text-slate-600">{a.clockOut ?? "—"}</td>
                      <td className="py-1.5 text-right text-slate-700">
                        {a.actualHours != null ? `${a.actualHours.toFixed(1)}h` : "—"}
                      </td>
                      <td className="py-1.5 text-right">
                        {a.isModified && a.confirmStatus === "unconfirmed" && (
                          <Badge variant="warning">承認待ち</Badge>
                        )}
                        {a.isModified && a.confirmStatus === "confirmed" && (
                          <Badge variant="success">承認済み</Badge>
                        )}
                      </td>
                      <td className="py-1.5 pl-2">
                        {!(a.isModified && a.confirmStatus === "unconfirmed") && (
                          <button
                            onClick={() => openCorrection(a)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="修正申請"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              打刻ミスがある場合は鉛筆アイコンから修正申請してください（管理者・マネージャーが承認します）。
            </p>
          </>
        )}
      </Card>

      {/* ─── 勤怠修正申請モーダル ─── */}
      <Modal
        isOpen={!!correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        title="勤怠修正申請"
        size="sm"
      >
        {correctionTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">{formatDate(correctionTarget.date)}</span> の勤怠を修正申請します。
              承認後に反映されます。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">出勤時刻</label>
                <input
                  type="time"
                  value={corrForm.clockIn}
                  onChange={(e) => setCorrForm({ ...corrForm, clockIn: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">退勤時刻</label>
                <input
                  type="time"
                  value={corrForm.clockOut}
                  onChange={(e) => setCorrForm({ ...corrForm, clockOut: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">休憩時間（分）</label>
              <input
                type="number"
                min={0}
                value={corrForm.breakMinutes}
                onChange={(e) => setCorrForm({ ...corrForm, breakMinutes: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={() => setCorrectionTarget(null)}>キャンセル</Button>
              <Button
                variant="primary"
                onClick={handleCorrection}
                disabled={correcting || (!corrForm.clockIn && !corrForm.clockOut)}
              >
                {correcting ? "送信中..." : "修正申請する"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── 通知設定 ─── */}
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
            setMemberDetail((prev) => prev ? { ...prev, ...updated } : prev);
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

// スコアドット（評価点を色付きバッジで表示）
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
