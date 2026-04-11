/**
 * 構造化ログユーティリティ
 *
 * Vercel Serverless では console.log/error がそのまま Vercel Log に送られる。
 * JSON 形式で出力することで、Vercel Log のフィルタリング・検索に対応する。
 * 将来的にロギングサービス（Datadog, Sentry 等）に差し替える場合、
 * このファイルのみ変更すれば全箇所に反映される。
 */

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, tag: string, message: string, detail?: unknown) {
  const entry = {
    level,
    tag,
    message,
    ...(detail !== undefined && {
      detail: detail instanceof Error ? { name: detail.name, message: detail.message } : detail,
    }),
    timestamp: new Date().toISOString(),
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (tag: string, message: string, detail?: unknown) => log("info", tag, message, detail),
  warn: (tag: string, message: string, detail?: unknown) => log("warn", tag, message, detail),
  error: (tag: string, message: string, detail?: unknown) => log("error", tag, message, detail),
};
