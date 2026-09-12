"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** 前台筛选工具栏（对齐参考站 czhlove.cn）：
 * - 标签容器："文章标签"标题 + 展开/收缩箭头，收缩时只显示标题
 * - 最新/精选切换胶囊：靠左对齐
 * 搜索已移到 header（SearchDialog 全屏弹出）
 */
export function PostToolbar({
  allTags,
  selectedTags,
  onToggleTag,
  onlyFeatured,
  onToggleFeatured,
}: {
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onlyFeatured: boolean;
  onToggleFeatured: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-10 space-y-5">
      {/* 标签容器（可展开/收缩） */}
      {allTags.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          {/* 标题栏：点击展开/收缩 */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
          >
            <span className="font-medium text-foreground">文章标签</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* 标签列表（展开时显示） */}
          {expanded && (
            <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className={`rounded-full border px-3.5 py-1 text-sm transition ${
                      active
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-fg-muted hover:text-fg hover:border-primary/30"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 最新/精选切换（靠左对齐） */}
      <div className="flex items-center justify-start">
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm">
          {(
            [
              { key: false, label: "最新" },
              { key: true, label: "精选" },
            ] as const
          ).map((o) => (
            <button
              key={String(o.key)}
              type="button"
              onClick={onToggleFeatured}
              className={`rounded-full px-5 py-1.5 transition ${
                onlyFeatured === o.key
                  ? "bg-fg text-bg font-medium"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
