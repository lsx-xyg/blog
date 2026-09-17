"use client";

/**
 * 管理页列表骨架（组合式，C6）
 *
 * 收敛六个管理页重复的页面骨架：AdminPageHeader + 错误条 + 搜索/筛选工具行 +
 * loading / 空态状态门。列表内容（桌面表格 / 移动卡片，含容器）作为 children
 * 由页面声明——只收敛骨架，不约束列结构。
 *
 * 约定：按钮顺序「新建在前、刷新在后」由调用方在 actions 中按序放置；
 * 搜索框在前、筛选在后由 search / filters 插槽天然保证。
 */
import type { ReactNode } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSearchInput } from "@/components/admin/search-input";
import { AdminLoadingState, AdminEmptyState } from "@/components/admin/status";

export interface AdminListPageProps {
  title: string;
  description?: ReactNode;
  /** 标题旁附加徽章/状态（如媒体库的存储驱动徽章） */
  titleExtra?: ReactNode;
  /** 右上角操作按钮组（新建在前、刷新在后） */
  actions?: ReactNode;
  /** 错误提示条（可选，如批量操作失败） */
  error?: string | null;
  /** 搜索框（可选） */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** 筛选区（可选，与搜索同行、位于其后） */
  filters?: ReactNode;
  loading?: boolean;
  /** 空态（loading 结束且无数据时展示） */
  empty?: { icon?: ReactNode; title: string; description?: string } | null;
  children?: ReactNode;
}

export function AdminListPage({
  title,
  description,
  titleExtra,
  actions,
  error,
  search,
  filters,
  loading,
  empty,
  children,
}: AdminListPageProps) {
  return (
    <div className="animate-page-enter space-y-4">
      <AdminPageHeader
        title={title}
        description={description}
        titleExtra={titleExtra}
        actions={actions}
      />

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {search || filters ? (
        <div className="flex flex-wrap items-center gap-3">
          {search ? (
            <AdminSearchInput
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
              className="max-w-md min-w-0 flex-1"
            />
          ) : null}
          {filters}
        </div>
      ) : null}

      {loading ? (
        <AdminLoadingState />
      ) : empty ? (
        <AdminEmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
        />
      ) : (
        children
      )}
    </div>
  );
}
