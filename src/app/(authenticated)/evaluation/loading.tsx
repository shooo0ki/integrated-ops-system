import { TablePageSkeleton } from "@/frontend/components/common/skeleton";

export default function Loading() {
  return <TablePageSkeleton kpiCount={3} rows={8} cols={7} />;
}
