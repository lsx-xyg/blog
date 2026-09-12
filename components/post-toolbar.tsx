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
      {/* 标签容器（可展开/收缩，总是渲染预留空间避免抖动） */}
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

          {/* 标签列表（max-height 过渡动画） */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2 min-h-[36px]">
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
            </div>
          </div>
        </div>

      {/* 最新/精选切换（靠左对齐，滑块动画） */}
      <div className="flex items-center justify-start">
        <div className="relative flex shrink-0 items-center rounded-full border border-border bg-surface p-1 text-sm">
          {/* 滑块 */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-fg transition-transform duration-300 ease-in-out ${
              onlyFeatured ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
            }`}
          />
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
              className={`relative z-10 w-[72px] rounded-full px-5 py-1.5 text-center transition-colors duration-300 ${
                onlyFeatured === o.key ? "text-bg font-medium" : "text-fg-muted hover:text-fg"
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
