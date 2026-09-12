"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** 前台筛选工具栏（对齐参考站 czhlove.cn，大气样式）：
 * - 标签区域：可展开/收缩（默认显示一行，超出隐藏），用容器包裹
 * - 最新/精选切换胶囊：放在标签下面，居中
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-10 space-y-5">
      {/* 标签筛选（可展开/收缩，容器包裹） */}
      {allTags.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div
            className={`flex flex-wrap gap-2 transition-all duration-300 ${
              expanded ? "" : "max-h-[44px] overflow-hidden"
            }`}
          >
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
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
          {allTags.length > 6 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  收起 <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  展开全部标签 <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 最新/精选切换（放在标签下面，居中） */}
      <div className="flex items-center justify-center">
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
              className={`rounded-full px-6 py-2 transition ${
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
