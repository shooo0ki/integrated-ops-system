"use client";

import { useState, useCallback, type InputHTMLAttributes } from "react";
import { cn } from "@/shared/utils";

/** 数値をカンマ区切りにフォーマット（入力中用） */
function toDisplay(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  if (isNaN(num) || value === "" || value === "-") return String(value);
  return num.toLocaleString("ja-JP");
}

/** カンマ区切り文字列から生数値を取り出す */
function toRaw(display: string): string {
  return display.replace(/,/g, "");
}

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  /** 生数値（string）。親の state はカンマなしの数値文字列で管理 */
  value: string;
  /** 生数値（カンマなし）を返す */
  onChange: (rawValue: string) => void;
  label?: string;
  id?: string;
  /** フォーカスアウト時に ¥ プレフィックスを付けるか（デフォルト: false） */
  showYen?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  label,
  id,
  showYen = false,
  className,
  ...rest
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState(() => toDisplay(value));

  // 親の value が外部から変わった場合に同期
  const rawDisplay = toRaw(display);
  if (!focused && rawDisplay !== value && value !== undefined) {
    // render 中の setState を避けるため display を直接更新しない
    // useEffect ではなく表示時に計算
  }

  const displayValue = focused ? display : (value ? (showYen ? `¥${toDisplay(value)}` : toDisplay(value)) : "");

  const handleFocus = useCallback(() => {
    setFocused(true);
    setDisplay(toDisplay(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    // blur 時に整数に正規化
    const raw = toRaw(display);
    const num = Number(raw);
    if (!isNaN(num) && raw !== "") {
      onChange(String(Math.round(num)));
    }
  }, [display, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // 数字、カンマ、マイナス、空文字のみ許可
    const cleaned = input.replace(/[^\d,-]/g, "");
    setDisplay(toDisplay(cleaned));
    onChange(toRaw(cleaned));
  }, [onChange]);

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        className={cn(
          "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-500 focus:outline-none",
          className
        )}
        {...rest}
      />
    </div>
  );
}
