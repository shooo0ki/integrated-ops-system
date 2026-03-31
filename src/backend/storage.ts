import { createHash } from "crypto";

/**
 * ファイルを Vercel Blob Storage にアップロード
 * @vercel/blob + BLOB_READ_WRITE_TOKEN が必要
 * 未設定の場合はスキップし null を返す
 */
export async function uploadFile(
  path: string,
  buffer: Buffer,
): Promise<{ url: string; hash: string } | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  const hash = createHash("sha256").update(buffer).digest("hex");

  try {
    // dynamic import で @vercel/blob が未インストールでもビルドを壊さない
    const { put } = await import("@vercel/blob");
    const blob = await put(path, buffer, {
      access: "public",
      addRandomSuffix: false,
    });
    return { url: blob.url, hash };
  } catch {
    return null;
  }
}

/**
 * Vercel Blob Storage からファイルを削除
 */
export async function deleteFile(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch {
    // ignore
  }
}
