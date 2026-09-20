'use client';

/**
 * 通用管理端弹窗外壳（C4·CRUD 骨架第三单元）
 *
 * 统一各管理页手写的新建/编辑弹窗：
 * - 遮罩层（可选点击外部关闭）+ 居中卡片 + 标题行 + 关闭按钮
 * - 内容区自动滚动（max-h-[92vh]）
 * - footer 插槽：保存/取消按钮区
 *
 * 页面只注入 title / children / footer，不再手写 fixed 定位与标题行。
 */
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export type AdminModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** 卡片最大宽度（默认 lg） */
  maxWidth?: 'md' | 'lg' | 'xl' | '3xl';
  /** 点击遮罩是否关闭（默认 true） */
  closeOnBackdrop?: boolean;
  /** 关闭按钮禁用（如保存中防误关） */
  closeDisabled?: boolean;
  /** 底部操作区（取消/保存按钮） */
  footer?: ReactNode;
  children: ReactNode;
};

const WIDTH_MAP = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '3xl': 'max-w-3xl',
} as const;

export function AdminModal({
  open,
  title,
  onClose,
  maxWidth = 'lg',
  closeOnBackdrop = true,
  closeDisabled = false,
  footer,
  children,
}: AdminModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className={`relative w-full ${WIDTH_MAP[maxWidth]} max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl animate-fade-in-up`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>{children}</div>

        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
