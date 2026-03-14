import { TablePageSkeleton } from "@/frontend/components/common/skeleton";

export default function Loading() {
  return <TablePageSkeleton rows={10} cols={8} />;
}
