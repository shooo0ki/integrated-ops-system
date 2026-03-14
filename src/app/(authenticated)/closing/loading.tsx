import { DashboardPageSkeleton } from "@/frontend/components/common/skeleton";

export default function Loading() {
  return <DashboardPageSkeleton kpiCount={4} rows={6} cols={6} />;
}
