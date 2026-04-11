import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// 暗号化済みデータのプレフィックス（平文との判別用）
const ENCRYPTED_PREFIX = "enc:";

function validateEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

// モジュール読み込み時に検証（BETTER_AUTH_SECRET と同じパターン）
const encryptionKey = validateEncryptionKey();

function getKey(): Buffer {
  return encryptionKey;
}

/**
 * AES-256-GCM で暗号化し、"enc:<base64>" 形式の文字列を返す
 * null/undefined/空文字はそのまま返す
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return plaintext as string | null;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // iv + authTag + encrypted → base64
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return `${ENCRYPTED_PREFIX}${combined.toString("base64")}`;
}

/**
 * "enc:<base64>" 形式の文字列を復号する
 * 全データ暗号化済みのため、平文が来たらエラー（暗号化バイパスの検知）
 */
export function decrypt(value: string | null | undefined): string | null {
  if (!value) return value as string | null;

  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error("Unencrypted data detected — all values must be encrypted");
  }

  const key = getKey();
  const combined = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

/** 銀行口座フィールドを暗号化する */
export function encryptBankFields(data: {
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
}): typeof data {
  return {
    ...data,
    ...(data.bankName !== undefined && { bankName: encrypt(data.bankName) }),
    ...(data.bankBranch !== undefined && { bankBranch: encrypt(data.bankBranch) }),
    ...(data.bankAccountNumber !== undefined && { bankAccountNumber: encrypt(data.bankAccountNumber) }),
    ...(data.bankAccountHolder !== undefined && { bankAccountHolder: encrypt(data.bankAccountHolder) }),
  };
}

/** 銀行口座フィールドを復号する */
export function decryptBankFields<T extends {
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
}>(data: T): T {
  return {
    ...data,
    ...(data.bankName !== undefined && { bankName: decrypt(data.bankName) }),
    ...(data.bankBranch !== undefined && { bankBranch: decrypt(data.bankBranch) }),
    ...(data.bankAccountNumber !== undefined && { bankAccountNumber: decrypt(data.bankAccountNumber) }),
    ...(data.bankAccountHolder !== undefined && { bankAccountHolder: decrypt(data.bankAccountHolder) }),
  };
}
