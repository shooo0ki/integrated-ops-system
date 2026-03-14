// ─── 契約管理の型定義 ─────────────────────────────────────

export type ContractStatus = "draft" | "sent" | "waiting_sign" | "completed" | "voided";

export interface ContractRecord {
  id: string;
  memberId: string;
  memberName: string;
  templateName: string;
  docusignTemplateId: string | null;
  status: ContractStatus;
  envelopeId: string | null;
  startDate: string | null;
  endDate: string | null;
  fileUrl: string | null;
  signerEmail: string;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ContractMember {
  id: string;
  name: string;
}

export interface DocuSignTemplate {
  templateId: string;
  name: string;
}
