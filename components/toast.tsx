"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

/** Toast 容器：固定在右上角，气泡通知自动消失 */
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

/** 单个 Toast 气泡 */
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setVisible(true));
    // 自动消失（3秒）
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const bgColors = {
    success: "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800",
    error: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800",
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out ${
        bgColors[toast.type]
      } ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}`}
      role="alert"
    >
      {icons[toast.type]}
      <span className="text-sm font-medium text-foreground">{toast.message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Toast Provider：包裹应用，提供 showToast 方法 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/** useToast Hook：在客户端组件中使用 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
