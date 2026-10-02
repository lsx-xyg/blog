'use client';

/**
 * 轻量 Tabs（受控，C7）
 *
 * 只做：列表 + 按钮 + 键盘语义（←/→ 移动焦点、Home/End 到头尾）。
 * 不做：动画 / 变体 / size / 非受控 API。样式对齐现有 button token。
 */
import { useId } from 'react';
import type { KeyboardEvent } from 'react';

export interface TabItem {
  value: string;
  label: string;
}

export function Tabs({
  value,
  onChange,
  items,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  items: TabItem[];
  className?: string;
}) {
  const baseId = useId();
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(items.length - 1, activeIndex + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, activeIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].value);
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={`flex items-center gap-1 border-b border-border ${className}`}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={`-mb-px inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
