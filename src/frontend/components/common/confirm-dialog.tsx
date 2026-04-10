"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const dialog = (
    <>
      {/* 背景オーバーレイ */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99998, backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onCancel}
      />
      {/* ダイアログ本体 */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 99999,
          width: 480,
          maxWidth: "calc(100vw - 2rem)",
          backgroundColor: "#fff",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ padding: "32px 32px 24px" }}>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          {description && (
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          )}
        </div>
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 32px", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={onCancel}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onMouseDown={(e) => { e.currentTarget.style.backgroundColor = "#e2e8f0"; }}
            onMouseUp={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
            style={{ padding: "8px 20px", fontSize: 14, fontWeight: 500, color: "#475569", backgroundColor: "transparent", border: "none", borderRadius: 8, cursor: "pointer", transition: "background-color 0.15s" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = variant === "danger" ? "#b91c1c" : "#1d4ed8"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = variant === "danger" ? "#dc2626" : "#2563eb"; }}
            onMouseDown={(e) => { e.currentTarget.style.backgroundColor = variant === "danger" ? "#991b1b" : "#1e40af"; }}
            onMouseUp={(e) => { e.currentTarget.style.backgroundColor = variant === "danger" ? "#b91c1c" : "#1d4ed8"; }}
            style={{
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              backgroundColor: variant === "danger" ? "#dc2626" : "#2563eb",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(dialog, document.body);
}
