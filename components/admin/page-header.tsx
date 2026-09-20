'use client';

/**
 * 通用管理端页头（C4·CRUD 骨架）
 *
 * 统一后台列表页标题区：h1 标题 + description 描述行 + 右侧 actions 操作区。
 * 以 manage-tags 的标准形态为基准，消除各页页头 h1/h2 层级与间距不一致。
 */
import type { ReactNode } from 'react';

export type AdminPageHeaderProps = {
  title: string;
  /** 描述行（如计数统计「共 N 个标签」） */
  description?: ReactNode;
  /** 标题右侧徽标插槽（如存储驱动 badge） */
  titleExtra?: ReactNode;
  /** 右侧操作区（新建/刷新/筛选等按钮） */
  actions?: ReactNode;
};

export function AdminPageHeader({ title, description, titleExtra, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
          {titleExtra}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
