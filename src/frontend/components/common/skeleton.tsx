/** Skeleton primitives for loading states */

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

function SkeletonCard({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 space-y-3 ${className}`}>
      {children ?? (
        <>
          <Skeleton className="h-5 w-1/3" />
          <SkeletonText lines={2} />
        </>
      )}
    </div>
  );
}

function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex gap-4 px-3 py-2.5">
      {Array.from({ length: cols }, (_, i) => (
        <Skeleton key={i} className={`h-4 flex-1 ${i === 0 ? "max-w-[120px]" : ""}`} />
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 5, className = "" }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="border-b border-slate-100 bg-slate-50">
        <SkeletonTableRow cols={cols} />
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </div>
    </div>
  );
}

/* ─ Page-level skeleton layouts ─ */

function SkeletonPageHeader() {
  return (
    <div className="space-y-1">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 ${count <= 2 ? "grid-cols-2" : count === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </SkeletonCard>
      ))}
    </div>
  );
}

/* ─ Pre-built page skeletons ─ */

/** Table page: header + optional KPI cards + table */
export function TablePageSkeleton({ kpiCount = 0, rows = 8, cols = 5 }: { kpiCount?: number; rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {kpiCount > 0 && <SkeletonKpiRow count={kpiCount} />}
      <SkeletonTable rows={rows} cols={cols} />
    </div>
  );
}

/** Card grid page: header + grid of cards */
export function CardGridPageSkeleton({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <div className={`grid gap-4 ${cols === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

/** Dashboard page: header + KPI cards + chart area + table */
export function DashboardPageSkeleton({ kpiCount = 4, rows = 6, cols = 5 }: { kpiCount?: number; rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonKpiRow count={kpiCount} />
      <SkeletonCard className="h-48" />
      <SkeletonTable rows={rows} cols={cols} />
    </div>
  );
}

/** Detail page: header + info card + table */
export function DetailPageSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <SkeletonTable rows={rows} cols={cols} />
    </div>
  );
}

/** MyPage: profile card + info cards */
export function MyPageSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard>
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </SkeletonCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard><SkeletonText lines={4} /></SkeletonCard>
        <SkeletonCard><SkeletonText lines={4} /></SkeletonCard>
      </div>
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}

/** Calendar: header + filter bar + grid */
export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-12 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <SkeletonCard>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </SkeletonCard>
      <div className="grid grid-cols-7 gap-px rounded-xl border border-slate-200 bg-slate-200 overflow-hidden">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="bg-white p-2 h-20">
            <Skeleton className="h-4 w-6 mb-1" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Form/settings page: header + form card */
export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard>
        <div className="space-y-4">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}

/** Inline content skeleton (replaces "読み込み中..." within a page section) */
export function InlineSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-3 py-4 ${className}`}>
      <Skeleton className="h-4 w-full max-w-md mx-auto" />
      <Skeleton className="h-4 w-3/4 max-w-sm mx-auto" />
      <Skeleton className="h-4 w-1/2 max-w-xs mx-auto" />
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonPageHeader, SkeletonKpiRow, SkeletonTableRow };
