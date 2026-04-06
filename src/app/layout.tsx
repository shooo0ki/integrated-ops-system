import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/frontend/contexts/auth-context";
import { SWRProvider } from "@/frontend/contexts/swr-provider";

const isDev = process.env.NODE_ENV === "development";

export const metadata: Metadata = {
  title: isDev ? "(dev) 統合業務管理システム" : "統合業務管理システム",
  description: "Boost / SALT2 統合業務管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <SWRProvider>
          <AuthProvider>{children}</AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
