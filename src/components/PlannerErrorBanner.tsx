"use client";

import { useTranslations } from "next-intl";

interface PlannerErrorBannerProps {
  testId: string;
  variant?: "warning" | "error";
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
}

export default function PlannerErrorBanner({
  testId, variant = "warning", title, body, onRetry, retryLabel, onDismiss,
}: PlannerErrorBannerProps) {
  const t = useTranslations("plannerErrorBanner");
  const palette = variant === "error"
    ? "bg-red-50 border-red-200 text-red-900"
    : "bg-amber-50 border-amber-200 text-amber-900";

  return (
    <div data-testid={testId} className={`rounded-lg border p-4 ${palette} flex items-start gap-3`}>
      <div className="text-xl" aria-hidden>⚠️</div>
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        {body && <p className="text-sm mt-1 opacity-90">{body}</p>}
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium underline hover:no-underline"
          >
            {retryLabel ?? t("retry")}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm opacity-70 hover:opacity-100"
            aria-label={t("dismiss")}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
