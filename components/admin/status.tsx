"use client";

/**
 * 通用管理端状态组件（C4·CRUD 骨架第二单元）
 *
 * - AdminLoadingState：加载中占位（统一动画脉冲文案）
 * - AdminEmptyState：空态卡片（虚线边框 + 图标 + 标题/说明 + 操作插槽）
 *
 * 统一 5 个管理页手写的加载/空态，页面只传文案与插槽。
 */
import type { ReactNode } from "react";

export function AdminLoadingState({ className = "" }: { className?: string }) {
  return (
    <div className={`py-12 text-center text-sm text-muted-foreground animate-pulse ${className}`}>
      加载中…
    </div>
  );
}

export type AdminEmptyStateProps = {
  /** 空态图标（如 <ImageIcon />） */
  icon?: ReactNode;
  /** 主文案（如「还没有图片」） */
  title?: string;
  /** 次要说明（如「点击上方按钮上传第一张」） */
  description?: string;
  /** 操作按钮插槽（如「新建」「上传」按钮） */
  action?: ReactNode;
  className?: string;
};

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: AdminEmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-border p-12 text-center animate-fade-in-up ${className}`}
    >
      {icon && <div className="mx-auto h-12 w-12 text-muted-foreground/50">{icon}</div>}
      {title && <p className="mt-4 text-sm text-muted-foreground">{title}</p>}
      {description && <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
