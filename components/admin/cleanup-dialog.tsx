'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AdminModal } from '@/components/admin/modal';

/**
 * 清理类弹窗公共组件（对齐视频 Tab 孤儿封面弹窗的纵向列表形态）
 *
 * 适用场景：清理未使用图片、清理孤儿封面等「预览列表 + 确认删除 + 逐条结果」弹窗。
 * 列表为纵向一行一条（缩略图 + 标题 + 副行信息 + 右侧状态标签），
 * 区别于网格布局，避免长条目横向挤压标题空间。
 */
export type CleanupItem = {
  id: string;
  url?: string | null;
  title?: string | null;
  subtitle?: string;
  badge?: string;
  /** 无 url 时的占位图标（如视频封面缺图显示 Clapperboard） */
  fallbackIcon?: ReactNode;
};

export type CleanupResult = {
  id: string;
  ok: boolean;
  reason?: string;
};

type CleanupDialogProps = {
  open: boolean;
  title: string;
  loading: boolean;
  deleting?: boolean;
  items: CleanupItem[];
  /** 删除后的逐条结果；有值时 body 显示结果列表、footer 显示「重新扫描」 */
  results?: CleanupResult[] | null;
  emptyText: string;
  deleteLabel: (count: number) => string;
  onClose: () => void;
  onDelete: () => void;
  onRescan?: () => void;
};

export function CleanupDialog({
  open,
  title,
  loading,
  deleting = false,
  items,
  results,
  emptyText,
  deleteLabel,
  onClose,
  onDelete,
  onRescan,
}: CleanupDialogProps) {
  return (
    <AdminModal
      open={open}
      title={title}
      onClose={onClose}
      closeOnBackdrop={!deleting}
      closeDisabled={deleting}
      maxWidth="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            关闭
          </button>
          {results ? (
            onRescan ? (
              <button
                type="button"
                onClick={onRescan}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                重新扫描
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={onDelete}
              disabled={items.length === 0 || deleting}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  删除中…
                </>
              ) : (
                deleteLabel(items.length)
              )}
            </button>
          )}
        </>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-3 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : results ? (
          <div className="space-y-2 py-1">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="truncate pr-3">{r.reason || '已删除'}</span>
                <span
                  className={
                    r.ok
                      ? 'shrink-0 text-green-600 dark:text-green-400'
                      : 'shrink-0 text-muted-foreground'
                  }
                >
                  {r.ok ? '✓ 已删除' : `跳过（${r.reason}）`}
                </span>
              </div>
            ))}
            {results.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : null}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.url ? (
                    <Image
                      src={item.url}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="absolute inset-0 m-auto text-xs text-muted-foreground">
                      无图
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.title ?? '未命名'}</p>
                  {item.subtitle ? (
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  ) : null}
                </div>
                {item.badge ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{item.badge}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminModal>
  );
}
