"use client";

import { useState } from "react";
import { Modal } from "@/frontend/components/common/modal";
import { Button } from "@/frontend/components/common/button";

import type { MemberDetail, ProfileForm } from "@/shared/types/mypage";

export function ProfileEditModal({
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
