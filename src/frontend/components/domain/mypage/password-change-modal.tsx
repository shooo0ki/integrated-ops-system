"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Modal } from "@/frontend/components/common/modal";
import { Button } from "@/frontend/components/common/button";

export function PasswordChangeModal({
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
