import NextLink, { type LinkProps } from "next/link";
import { type AnchorHTMLAttributes } from "react";

/**
 * prefetch={false} をデフォルトにしたカスタムLinkコンポーネント。
 * RSCプリフェッチによる同時接続数超過（503）と連鎖APIコール問題を防ぐ。
 * 明示的に prefetch={true} を渡すことでプリフェッチを有効化できる。
 */
type AppLinkProps = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export default function AppLink({ prefetch = false, ...props }: AppLinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
