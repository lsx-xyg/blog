"use client";

/**
 * 通用确认对话框（管理端 CRUD 骨架·最小共享单元）
 *
 * 替代各管理页手写的 window.confirm，统一样式与交互：
 * - 受控组件（open + onClose）
 * - danger 变体：危险按钮红色样式（删除/清空等不可逆操作）
 * - loading：确认中的异步状态（防重复点击）
 */
import type { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

export type ConfirmDialogProps = {
  open: boolean;
  /** 标题（如「删除文章」） */
  title: string;
  /** 描述/风险说明（ReactNode，支持多行） */
  description?: ReactNode;
  /** 确认按钮文案（默认「确认」） */
  confirmLabel?: string;
  /** 取消按钮文案（默认「取消」） */
  cancelLabel?: string;
  /** 危险操作：确认按钮用红色强调（默认 true） */
  danger?: boolean;
  /** 确认中：按钮 loading 并禁用 */
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = true,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${danger ? "text-red-500" : "text-muted-foreground"}`} />
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md p-1 hover:bg-accent disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {description && (
          <div className="p-4 text-sm leading-relaxed text-muted-foreground">{description}</div>
        )}

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {loading ? "处理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
