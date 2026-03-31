"use client";

import { SWRConfig } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 2_000,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { fetcher };
