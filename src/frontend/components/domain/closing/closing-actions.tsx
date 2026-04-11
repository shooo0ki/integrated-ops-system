"use client";

import { Send, RefreshCw, Zap, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/frontend/components/common/button";

interface ClosingActionsProps {
  confirmStatus: string;
  isSending: boolean;
  isForcing: boolean;
  onSendSlack: () => void;
  onForce: () => void;
  /** 請求書がある場合のみ */
  invoice?: { id: string } | null;
  onShowDetail?: () => void;
  onSendAccounting?: () => void;
  isSendingAccounting?: boolean;
}

export function ClosingActions({
  confirmStatus,
  isSending,
  isForcing,
  onSendSlack,
  onForce,
  invoice,
  onShowDetail,
  onSendAccounting,
  isSendingAccounting,
}: ClosingActionsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {confirmStatus === "not_sent" && (
        <Button size="sm" variant="outline" onClick={onSendSlack} disabled={isSending}>
          <Send size={12} /> {isSending ? "送信中" : "通知"}
        </Button>
      )}
      {confirmStatus === "waiting" && (
        <>
          <Button size="sm" variant="outline" onClick={onSendSlack} disabled={isSending}>
            <RefreshCw size={12} /> {isSending ? "送信中" : "再通知"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onForce} disabled={isForcing}>
            <Zap size={12} /> {isForcing ? "処理中" : "強制確定"}
          </Button>
        </>
      )}
      {invoice && onShowDetail && (
        <Button size="sm" variant="outline" onClick={onShowDetail}>
          <FileText size={12} /> 明細
        </Button>
      )}
      {invoice && onSendAccounting && (
        <Button size="sm" variant="outline" onClick={onSendAccounting} disabled={isSendingAccounting}>
          <ExternalLink size={12} /> {isSendingAccounting ? "送信中" : "LayerX"}
        </Button>
      )}
    </div>
  );
}
