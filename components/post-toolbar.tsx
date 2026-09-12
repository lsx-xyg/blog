"use client";

/** 前台筛选工具栏（对齐参考站 czhlove.cn）：最新/精选切换 + 标签横排多选（URL 不变）
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
    <div className="mb-8 space-y-3">
      {/* 最新/精选切换 */}
      <div className="flex items-center justify-between">
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs">
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
              className={`rounded-md px-2.5 py-1.5 transition ${
                onlyFeatured === o.key
                  ? "bg-fg text-bg"
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
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-fg-muted hover:text-fg"
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
