"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 通用确认对话框组件
 *
 * 用于替代浏览器的 confirm()，风格与系统保持一致。
 * 支持自定义标题、描述、确认按钮文本、取消按钮文本、确认按钮颜色。
 *
 * @example
 * const [confirmOpen, setConfirmOpen] = useState(false);
 * const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
 *
 * const handleDelete = () => {
 *   setConfirmAction(() => () => {
 *     // 执行删除操作
 *   });
 *   setConfirmOpen(true);
 * };
 *
 * <ConfirmDialog
 *   open={confirmOpen}
 *   title="确认删除"
 *   description="确定要删除这个项目吗？此操作不可恢复。"
 *   confirmText="删除"
 *   cancelText="取消"
 *   variant="destructive"
 *   onConfirm={() => { confirmAction(); setConfirmOpen(false); }}
 *   onCancel={() => setConfirmOpen(false)}
 * />
 */
interface ConfirmDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 标题 */
  title: string;
  /** 描述（可选） */
  description?: string;
  /** 确认按钮文本（默认"确认"） */
  confirmText?: string;
  /** 取消按钮文本（默认"取消"） */
  cancelText?: string;
  /** 确认按钮样式（默认"default"，危险操作用"destructive"） */
  variant?: "default" | "destructive";
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // ESC 键关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  // 锁定背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 图标和标题 */}
        <div className="flex items-start gap-4">
          {variant === "destructive" && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        {/* 按钮组 */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
