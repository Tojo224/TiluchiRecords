import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
  /** Optional call to action; clicking it runs `onClick` and dismisses. */
  action?: { label: string; onClick: () => void };
};

const DEFAULT_DURATION_MS = 4500;

type ToastContextValue = {
  toast: {
    success: (message: string, title?: string) => string;
    error: (message: string, title?: string) => string;
    info: (message: string, title?: string) => string;
    warning: (message: string, title?: string) => string;
    /** Returns the toast id so callers can dismiss or replace it. */
    custom: (options: Omit<Toast, "id">) => string;
  };
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev.slice(-4), newToast]); // Keep at most 5
    return id;
  }, []);

  const toastMethods = useMemo(
    () => ({
      success: (message: string, title?: string) =>
        addToast({ type: "success", message, title }),
      error: (message: string, title?: string) =>
        addToast({ type: "error", message, title, durationMs: 6000 }),
      info: (message: string, title?: string) =>
        addToast({ type: "info", message, title }),
      warning: (message: string, title?: string) =>
        addToast({ type: "warning", message, title, durationMs: 5000 }),
      custom: addToast,
    }),
    [addToast],
  );
  const contextValue = useMemo(
    () => ({ toast: toastMethods, dismiss }),
    [toastMethods, dismiss],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast viewport. Lifted to bottom-20 so it never covers the floating
          "Guia" launcher (bottom-4, ~44px tall, bottom-right, z-30). */}
      <div
        role="region"
        aria-label="Notificaciones"
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.durationMs || DEFAULT_DURATION_MS);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Auto-dismiss lives in the card so unmounting clears it. Hover or focus
  // pauses it and resumes with the time that was left.
  useEffect(() => {
    if (paused || leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(
      () => onDismissRef.current(),
      remainingRef.current,
    );
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAt),
      );
    };
  }, [paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => onDismissRef.current(), 200);
    return () => clearTimeout(timer);
  }, [leaving]);

  const icons = {
    success: (
      <CheckCircle2 className="size-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
    ),
    error: (
      <AlertCircle className="size-5 shrink-0 text-rose-500 dark:text-rose-400" />
    ),
    warning: (
      <AlertTriangle className="size-5 shrink-0 text-amber-500 dark:text-amber-400" />
    ),
    info: <Info className="size-5 shrink-0 text-sky-500 dark:text-sky-400" />,
  };

  const borders = {
    success:
      "border-emerald-500/20 bg-emerald-50/95 dark:border-emerald-500/20 dark:bg-[#071d18]/95",
    error:
      "border-rose-500/20 bg-rose-50/95 dark:border-rose-500/20 dark:bg-[#200b0e]/95",
    warning:
      "border-amber-500/20 bg-amber-50/95 dark:border-amber-500/20 dark:bg-[#201705]/95",
    info: "border-sky-500/20 bg-sky-50/95 dark:border-sky-500/20 dark:bg-[#081a28]/95",
  };

  function handleDismiss() {
    setLeaving(true);
  }

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 ${
        borders[toast.type]
      } ${
        leaving
          ? "translate-x-4 opacity-0"
          : "translate-x-0 opacity-100 animate-in fade-in slide-in-from-bottom-2"
      }`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && (
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
            {toast.title}
          </p>
        )}
        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
          {toast.message}
        </p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
        aria-label="Cerrar notificación"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
