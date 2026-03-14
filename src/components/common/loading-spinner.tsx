export function LoadingSpinner({ message = "読み込み中..." }: { message?: string }) {
  return (
    <div className="py-20 text-center text-slate-400 text-sm">{message}</div>
  );
}
