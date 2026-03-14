/**
 * DocuSign eSign API ユーティリティ
 * JWT Grant 認証を使用
 *
 * 使用前に以下の環境変数が必要:
 *   DOCUSIGN_ACCOUNT_ID
 *   DOCUSIGN_INTEGRATION_KEY
 *   DOCUSIGN_USER_ID
 *   DOCUSIGN_PRIVATE_KEY_BASE64  (RSA秘密鍵をBase64エンコード)
 *   DOCUSIGN_BASE_URL            (例: https://demo.docusign.net/restapi)
 *   DOCUSIGN_WEBHOOK_SECRET
 *   DOCUSIGN_SIGNER_ROLE_NAME    (デフォルト: "Signer")
 */

import { createHmac } from "crypto";

// ─── 型定義 ──────────────────────────────────────────────

interface DocuSignConfig {
  accountId: string;
  integrationKey: string;
  userId: string;
  privateKeyBase64: string;
  baseUrl: string;
}

interface SendEnvelopeParams {
  templateId: string;
  signerEmail: string;
  signerName: string;
  prefillTabs?: {
    contractorName?: string;    // タブLabel: "契約者氏名"
    startDate?: string;         // タブLabel: "契約開始日"（例: "2026年4月1日"）
    endDate?: string;           // タブLabel: "契約終了日"
    address?: string;           // タブLabel: "住所"
    bankName?: string;          // タブLabel: "銀行名"
    bankBranch?: string;        // タブLabel: "支店名"
    bankAccountNumber?: string; // タブLabel: "口座番号"
    bankAccountHolder?: string; // タブLabel: "口座名義"
  };
}

// ─── 設定取得 ─────────────────────────────────────────────

function getConfig(): DocuSignConfig {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const privateKeyBase64 = process.env.DOCUSIGN_PRIVATE_KEY_BASE64;
  const baseUrl = process.env.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi";

  if (!accountId || !integrationKey || !userId || !privateKeyBase64) {
    throw new Error("DocuSign 環境変数が設定されていません");
  }

  return { accountId, integrationKey, userId, privateKeyBase64, baseUrl };
}

// ─── JWT Grant 認証 ───────────────────────────────────────

/**
 * JWT Grant でアクセストークンを取得する
 * (サーバーサイド専用 — 秘密鍵を使用)
 */
async function getAccessToken(): Promise<string> {
  const { integrationKey, userId, privateKeyBase64 } = getConfig();

  // JWT ペイロード生成
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: integrationKey,
      sub: userId,
      aud: "account-d.docusign.com",
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    })
  ).toString("base64url");

  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");

  // Node.js crypto で RSA-SHA256 署名
  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://account-d.docusign.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DocuSign token error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ─── テンプレート一覧取得 ──────────────────────────────────

/**
 * DocuSign アカウントのテンプレート一覧を取得する
 */
export async function getTemplates(): Promise<{ templateId: string; name: string }[]> {
  const { accountId, baseUrl } = getConfig();
  const token = await getAccessToken();

  const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/templates`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign getTemplates error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    envelopeTemplates?: { templateId: string; name: string }[];
  };

  return (data.envelopeTemplates ?? []).map((t) => ({
    templateId: t.templateId,
    name: t.name,
  }));
}

// ─── エンベロープ送付（テンプレート方式）────────────────────

/**
 * DocuSign テンプレートを使って署名依頼エンベロープを作成・送付する
 * - templateRoles で署名者を指定
 * - prefillTabs で管理者が事前記入する項目を渡す
 * @returns envelopeId
 */
export async function sendEnvelope(params: SendEnvelopeParams): Promise<{ envelopeId: string }> {
  const { accountId, baseUrl } = getConfig();
  const token = await getAccessToken();

  const signerRoleName = process.env.DOCUSIGN_SIGNER_ROLE_NAME ?? "Signer";

  // pre-fill タブを構築（値が存在するもののみ追加）
  const textTabs: { tabLabel: string; value: string }[] = [];
  if (params.prefillTabs?.contractorName) {
    textTabs.push({ tabLabel: "契約者氏名", value: params.prefillTabs.contractorName });
  }
  if (params.prefillTabs?.startDate) {
    textTabs.push({ tabLabel: "契約開始日", value: params.prefillTabs.startDate });
  }
  if (params.prefillTabs?.endDate) {
    textTabs.push({ tabLabel: "契約終了日", value: params.prefillTabs.endDate });
  }
  if (params.prefillTabs?.address) {
    textTabs.push({ tabLabel: "住所", value: params.prefillTabs.address });
  }
  if (params.prefillTabs?.bankName) {
    textTabs.push({ tabLabel: "銀行名", value: params.prefillTabs.bankName });
  }
  if (params.prefillTabs?.bankBranch) {
    textTabs.push({ tabLabel: "支店名", value: params.prefillTabs.bankBranch });
  }
  if (params.prefillTabs?.bankAccountNumber) {
    textTabs.push({ tabLabel: "口座番号", value: params.prefillTabs.bankAccountNumber });
  }
  if (params.prefillTabs?.bankAccountHolder) {
    textTabs.push({ tabLabel: "口座名義", value: params.prefillTabs.bankAccountHolder });
  }

  const body = {
    status: "sent",
    templateId: params.templateId,
    templateRoles: [
      {
        roleName: signerRoleName,
        email: params.signerEmail,
        name: params.signerName,
        tabs: {
          textTabs,
        },
      },
    ],
  };

  const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign sendEnvelope error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { envelopeId: string };
  return { envelopeId: data.envelopeId };
}

// ─── エンベロープ無効化 ───────────────────────────────────

/**
 * 送付済みエンベロープを無効化する
 */
export async function voidEnvelope(envelopeId: string, reason = "管理者により無効化"): Promise<void> {
  const { accountId, baseUrl } = getConfig();
  const token = await getAccessToken();

  const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "voided", voidedReason: reason }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign voidEnvelope error: ${res.status} ${err}`);
  }
}

// ─── 署名済みPDF URL取得 ──────────────────────────────────

/**
 * 署名済みドキュメントのダウンロードURLを取得する
 */
export async function getDocumentDownloadUrl(envelopeId: string): Promise<string> {
  const { accountId, baseUrl } = getConfig();
  const token = await getAccessToken();

  const res = await fetch(
    `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign getDocument error: ${res.status} ${err}`);
  }

  // Blob URLを返す（実際の運用ではS3等にアップロードしてURLを返す）
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Webhook HMAC 検証 ────────────────────────────────────

/**
 * DocuSign Connect Webhookのペイロード署名を検証する
 */
export function verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(payload).digest("base64");
  return expected === signatureHeader;
}
