/**
 * インメモリ レート制限
 *
 * Vercel Serverless では関数インスタンスごとにメモリが独立するため
 * 完全な分散レート制限にはならないが、単一インスタンス内での
 * ブルートフォース攻撃を抑止する基本防御として機能する。
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// 古いエントリを定期的に掃除（メモリリーク防止）
const CLEANUP_INTERVAL = 60_000; // 1分
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * レート制限チェック
 * @param key    識別キー（例: IPアドレス、"ip:path" の組み合わせ）
 * @param limit  ウィンドウ内の最大リクエスト数
 * @param windowMs ウィンドウの長さ（ミリ秒）
 * @returns { limited: true } の場合リクエストを拒否すべき
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { limited: boolean; remaining: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1 };
  }

  entry.count += 1;

  if (entry.count > limit) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: limit - entry.count };
}
