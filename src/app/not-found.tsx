import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-slate-300">404</h1>
      <p className="text-slate-600">ページが見つかりません</p>
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ダッシュボードに戻る
      </Link>
    </div>
  );
}
