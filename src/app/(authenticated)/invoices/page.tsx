"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InvoicesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/closing"); }, [router]);
  return null;
}
