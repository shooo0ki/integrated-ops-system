import type { ReactNode } from "react";

export function EmptyState({
  icon,
  message,
}: {
  icon?: ReactNode;
  message: string;
}) {
  return (
    <div className="py-12 text-center text-sm text-slate-400">
      {icon && <div className="mx-auto mb-2">{icon}</div>}
      {message}
    </div>
  );
}
