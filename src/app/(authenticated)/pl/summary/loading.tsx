import { DashboardPageSkeleton } from "@/frontend/components/common/skeleton";

export default function Loading() {
  return <DashboardPageSkeleton kpiCount={4} rows={8} cols={7} />;
}
