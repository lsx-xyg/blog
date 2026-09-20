'use client';

/**
 * 管理页操作按钮（统一模板，C6）
 *
 * 收敛六页重复的「新建 / 刷新」按钮模板：
 * - 移动端只显示图标（隐藏文字）
 * - 新建在前、刷新在后由调用方按序放置
 * - 禁用/加载态内置（刷新加载中图标旋转）
 */
import type { ComponentType } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

const base =
  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

/** 主操作（新建/创建/上传）：实心主色，图标 + 文字（移动端仅图标） */
export function CreateButton({
  onClick,
  label,
  icon: Icon = Plus,
  disabled,
  title,
}: {
  onClick: () => void;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} bg-primary text-primary-foreground hover:bg-primary/90`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** 刷新按钮：边框样式，加载中图标旋转 */
export function RefreshButton({
  onClick,
  loading,
  label = '刷新',
  disabled,
  title = '刷新列表',
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${base} border border-input bg-background hover:bg-accent`}
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
