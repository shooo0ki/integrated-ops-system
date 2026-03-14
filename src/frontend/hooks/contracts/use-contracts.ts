"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ContractStatus, ContractRecord, ContractMember as Member, DocuSignTemplate } from "@/shared/types/contracts";
import { STATUS_ORDER } from "@/frontend/constants/contracts";

export function useContracts() {
  const { data: contracts = [], isLoading: loading, mutate: mutateContracts } = useSWR<ContractRecord[]>("/api/contracts");
  const { data: membersData } = useSWR<{ members?: Member[] } | Member[]>("/api/members");
  const members: Member[] = membersData
    ? (Array.isArray(membersData) ? membersData : (membersData.members ?? []))
    : [];
  const { data: dsTemplates = [], isLoading: templatesLoading } = useSWR<DocuSignTemplate[]>("/api/contracts/templates");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [memberType, setMemberType] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    memberId: "", signerEmail: "",
    newName: "", newEmail: "", newStatus: "employee", newPhone: "",
    newAddress: "", newBankName: "", newBankBranch: "",
    newBankAccountNumber: "", newBankAccountHolder: "",
    templateId: "", templateName: "", startDate: "", endDate: "",
  });
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const filtered = contracts.filter((c) => {
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchMember = memberFilter === "ALL" || c.memberId === memberFilter;
    return matchStatus && matchMember;
  });

  const selected = contracts.find((c) => c.id === selectedId);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = contracts.filter((c) => c.status === s).length;
    return acc;
  }, {});

  function resetForm() {
    setMemberType("existing");
    setForm({
      memberId: "", signerEmail: "",
      newName: "", newEmail: "", newStatus: "employee", newPhone: "",
      newAddress: "", newBankName: "", newBankBranch: "",
      newBankAccountNumber: "", newBankAccountHolder: "",
      templateId: "", templateName: "", startDate: "", endDate: "",
    });
  }

  async function handleCreate() {
    setCreating(true);
    const common = {
      templateName: form.templateName,
      docusignTemplateId: form.templateId || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };

    let res: Response;
    if (memberType === "new") {
      res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberType: "new",
          name: form.newName, email: form.newEmail, status: form.newStatus,
          phone: form.newPhone || undefined, address: form.newAddress || undefined,
          bankName: form.newBankName || undefined, bankBranch: form.newBankBranch || undefined,
          bankAccountNumber: form.newBankAccountNumber || undefined,
          bankAccountHolder: form.newBankAccountHolder || undefined,
          ...common,
        }),
      });
    } else {
      res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberType: "existing",
          memberId: form.memberId, signerEmail: form.signerEmail,
          ...common,
        }),
      });
    }

    if (res.ok) {
      setShowCreate(false);
      resetForm();
      showToast("契約ドラフトを作成しました");
      await mutateContracts();
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "作成失敗"}`);
    }
    setCreating(false);
  }

  async function handleSend(contract: ContractRecord) {
    setActionLoading(true);
    const res = await fetch(`/api/members/${contract.memberId}/contracts/${contract.id}/send`, { method: "POST" });
    if (res.ok) {
      showToast("署名依頼を送付しました");
      await mutateContracts();
      setSelectedId(null);
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "送付失敗"}`);
    }
    setActionLoading(false);
  }

  async function handleVoid(contract: ContractRecord) {
    if (!confirm("この契約を無効化しますか？")) return;
    setActionLoading(true);
    const res = await fetch(`/api/members/${contract.memberId}/contracts/${contract.id}/void`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "管理者により無効化" }),
    });
    if (res.ok) {
      showToast("契約を無効化しました");
      await mutateContracts();
      setSelectedId(null);
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "無効化失敗"}`);
    }
    setActionLoading(false);
  }

  async function handleDownload(contract: ContractRecord) {
    setActionLoading(true);
    const res = await fetch(`/api/members/${contract.memberId}/contracts/${contract.id}/download-url`);
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "取得失敗"}`);
    }
    setActionLoading(false);
  }

  return {
    contracts, loading, members, dsTemplates, templatesLoading,
    statusFilter, setStatusFilter, memberFilter, setMemberFilter,
    selectedId, setSelectedId, selected,
    toastMsg, filtered, counts,
    showCreate, setShowCreate, memberType, setMemberType, form, setForm,
    creating, actionLoading,
    resetForm, handleCreate, handleSend, handleVoid, handleDownload,
  };
}
