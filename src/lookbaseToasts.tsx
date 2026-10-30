import React, { useCallback, useEffect, useRef, useState } from "react";

export type ToastVariant = "info" | "success" | "error";

export interface LookBaseToast {
  id: string;
  message: string;
  variant: ToastVariant;
  timeoutMs?: number | null;
}

export function useLookBaseToasts() {
  const [toasts, setToasts] = useState<LookBaseToast[]>([]);
  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleToastTimer = useCallback(
    (id: string, timeoutMs?: number | null) => {
      if (toastTimersRef.current[id]) {
        clearTimeout(toastTimersRef.current[id]);
        delete toastTimersRef.current[id];
      }
      if (typeof timeoutMs === "number" && timeoutMs > 0) {
        toastTimersRef.current[id] = setTimeout(() => {
          dismissToast(id);
        }, timeoutMs);
      }
    },
    [dismissToast],
  );

  const resolveTimeout = (variant: ToastVariant, ms?: number | null) =>
    ms !== undefined ? ms : variant === "info" ? null : variant === "error" ? 6000 : 4000;

  const pushToast = useCallback(
    (opts: { message: string; variant?: ToastVariant; timeoutMs?: number | null }): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const variant: ToastVariant = opts.variant || "info";
      const timeoutMs = resolveTimeout(variant, opts.timeoutMs);
      setToasts((prev) => [...prev, { id, message: opts.message, variant, timeoutMs }]);
      scheduleToastTimer(id, timeoutMs);
      return id;
    },
    [scheduleToastTimer],
  );

  const updateToast = useCallback(
    (
      id: string,
      patch: { message?: string; variant?: ToastVariant; timeoutMs?: number | null },
    ) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const nextVariant = patch.variant || t.variant;
          const nextTimeout = resolveTimeout(nextVariant, patch.timeoutMs);
          scheduleToastTimer(id, nextTimeout);
          return {
            ...t,
            ...(patch.message !== undefined ? { message: patch.message } : {}),
            variant: nextVariant,
            timeoutMs: nextTimeout,
          };
        }),
      );
    },
    [scheduleToastTimer],
  );

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  return { toasts, pushToast, updateToast, dismissToast };
}

export const LookBaseToastStack: React.FC<{
  toasts: LookBaseToast[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      id="lookbase-toast-stack"
      className="lookbase-toast-stack"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.id} className={`lookbase-toast ${t.variant}`}>
          <span className="lookbase-toast-left">
            {t.variant === "info" && <span className="lookbase-toast-spinner" />}
            {t.variant === "success" && <span aria-hidden="true">✓</span>}
            {t.variant === "error" && <span aria-hidden="true">⚠</span>}
            <span>{t.message}</span>
          </span>
          <button
            type="button"
            className="lookbase-toast-close"
            onClick={() => onDismiss(t.id)}
            title="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
