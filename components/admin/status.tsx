'use client';

/**
 * 通用管理端状态组件（C4·CRUD 骨架第二单元）
 *
 * - AdminLoadingState：加载中占位（统一动画脉冲文案）
 * - AdminEmptyState：空态卡片（虚线边框 + 图标 + 标题/说明 + 操作插槽）
 *
 * 统一 5 个管理页手写的加载/空态，页面只传文案与插槽。
 */
import type { ReactNode } from 'react';

/**
 * 加载骨架屏（统一后台列表加载样式）
 *
 * - 默认 "table"：桌面表格形态 + 移动紧凑行形态（响应式）
 * - "grid"：媒体网格方块形态
 *
 * 取代手写骨架屏与纯文字「加载中…」，视觉占位减少布局跳动。
 */
export type AdminLoadingStateProps = {
  variant?: 'table' | 'grid';
  className?: string;
};

export function AdminLoadingState({ variant = 'table', className = '' }: AdminLoadingStateProps) {
  if (variant === 'grid') {
    return (
      <div
        className={`grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${className}`}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="aspect-video overflow-hidden rounded-lg border border-border bg-muted/30"
          >
            <div className="h-full w-full animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`animate-fade-in-up ${className}`} aria-busy="true" aria-label="加载中">
      {/* 桌面骨架：表格形态 */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
          <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 shrink-0 animate-pulse rounded bg-muted" />
          <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 shrink-0 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 shrink-0 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 shrink-0 animate-pulse rounded bg-muted" />
          <div className="h-6 w-28 shrink-0 animate-pulse rounded bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
          >
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 shrink-0 animate-pulse rounded bg-muted" />
            <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 shrink-0 animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 shrink-0 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 shrink-0 animate-pulse rounded bg-muted" />
            <div className="h-6 w-28 shrink-0 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* 移动骨架：紧凑行形态 */}
      <div className="md:hidden overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-muted" />
              <div className="h-8 w-20 shrink-0 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
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
  className = '',
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
