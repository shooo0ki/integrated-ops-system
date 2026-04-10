import { AlertCircle } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorAlert({ message, onRetry, onDismiss }: ErrorAlertProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p>{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-medium text-red-600 hover:underline">
            再試行
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="text-xs text-red-400 hover:text-red-600">
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
