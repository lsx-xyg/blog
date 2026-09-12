"use client";

/** 前台筛选工具栏（对齐参考站 czhlove.cn，大气样式）：最新/精选切换 + 标签横排多选（URL 不变）
 * 搜索已移到 header（SearchDialog 弹出式）
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
  return (
    <div className="mb-10 space-y-4">
      {/* 最新/精选切换 */}
      <div className="flex items-center justify-between">
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
              className={`rounded-full px-5 py-2 transition ${
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

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
      )}
    </div>
  );
}
