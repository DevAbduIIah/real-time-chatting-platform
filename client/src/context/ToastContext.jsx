/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

function buildToastId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getToneClasses(tone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-50';
    case 'error':
      return 'border-rose-400/50 bg-rose-500/10 text-rose-50';
    default:
      return 'theme-border theme-surface theme-text';
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef(new Map());

  const removeToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));

    const timeoutId = timeoutsRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(toastId);
    }
  }, []);

  const pushToast = useCallback(({ title, message, tone = 'default', duration = DEFAULT_DURATION }) => {
    const toastId = buildToastId();
    const nextToast = { id: toastId, title, message, tone };

    setToasts((prev) => [...prev.slice(-2), nextToast]);

    if (duration > 0) {
      const timeoutId = window.setTimeout(() => {
        removeToast(toastId);
      }, duration);

      timeoutsRef.current.set(toastId, timeoutId);
    }

    return toastId;
  }, [removeToast]);

  useEffect(() => {
    const activeTimeouts = timeoutsRef.current;

    return () => {
      activeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      activeTimeouts.clear();
    };
  }, []);

  const value = useMemo(() => ({ pushToast, removeToast }), [pushToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-3xl border px-4 py-3 shadow-xl backdrop-blur ${getToneClasses(toast.tone)}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
                {toast.message && <p className="mt-1 text-sm opacity-90">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-full px-2 py-1 text-xs font-semibold opacity-70 transition hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
