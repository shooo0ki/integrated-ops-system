"use client";

import NextLink, { type LinkProps } from "next/link";
import { type AnchorHTMLAttributes } from "react";

/**
 * prefetch={false} を強制するカスタムLinkコンポーネント。
 * RSCプリフェッチによる同時接続数超過（503）と連鎖APIコール問題を防ぐ。
 */
type AppLinkProps = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export default function AppLink(props: AppLinkProps) {
  return <NextLink {...props} prefetch={false} />;
}
