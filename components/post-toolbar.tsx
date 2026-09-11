"use client";

/** 前台筛选工具栏（T7 方案 A 纯客户端）：搜索框 + 最新/精选切换 + 标签横排多选（URL 不变） */

export function PostToolbar({
  allTags,
  selectedTags,
  onToggleTag,
  onlyFeatured,
  onToggleFeatured,
  query,
  onQueryChange,
}: {
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onlyFeatured: boolean;
  onToggleFeatured: () => void;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索文章…"
          className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none transition placeholder:text-fg-faint focus:border-accent"
        />
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
                    ? "border-accent bg-accent/10 text-accent"
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
