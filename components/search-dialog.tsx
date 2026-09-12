"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import MiniSearch from "minisearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** minisearch 中文分词：拉丁词按词，中文按单字 + 连续双字（bigram）索引 */
function cjkTokenize(text: string): string[] {
  const parts = text.toLowerCase().match(/[\u4e00-\u9fa5]+|[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const p of parts) {
    if (/[\u4e00-\u9fa5]/.test(p)) {
      for (let i = 0; i < p.length; i++) out.push(p[i]);
      for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i, i + 2));
    } else {
      out.push(p);
    }
  }
  return out;
}

type SearchPost = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  featured: boolean;
  createdAt: string | null;
  publishedAt: string | null;
  tags: string[];
};

/** 搜索弹出层（对齐参考站 czhlove.cn）：
 * - 触发器只展示放大镜图标（50x50），点击后图标保持原位不消失
 * - 全屏半透明虚化遮罩
 * - 搜索框居中偏上，实时显示搜索结果列表
 * - 点击结果直接进入详情页，不用 URL 参数
 */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 初始化 minisearch 索引
  const index = useMemo(() => {
    return new MiniSearch({
      idField: "id",
      fields: ["title", "summary", "tags"],
      storeFields: ["title", "summary", "slug", "id", "publishedAt", "tags"],
      tokenize: cjkTokenize,
    });
  }, []);

  // 拉取搜索索引数据
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/search-index");
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled && d.posts?.length) {
          setPosts(d.posts);
          index.addAll(d.posts);
        }
      } catch {
        /* 忽略 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index]);

  // 实时搜索结果
  const results = useMemo(() => {
    if (!query.trim()) return [];
    try {
      return index.search(query.trim(), { prefix: true, fuzzy: 0.2 }).slice(0, 8);
    } catch {
      return [];
    }
  }, [query, index]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goPost = (post: { id: string; slug: string | null }) => {
    router.push(`/posts/${post.slug ?? post.id}`);
    setOpen(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <>
      {/* 搜索图标按钮：始终渲染，避免页面抖动 */}
      {/* 搜索按钮（带 tooltip） */}
      <div className="group relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-[50px] w-[50px] rounded-full hover:bg-accent"
          onClick={() => setOpen(true)}
          aria-label="搜索"
        >
          <Search className="h-5 w-5" strokeWidth={2.5} />
        </Button>
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-50">
          搜索 Ctrl+K
        </span>
      </div>

      {/* 全屏搜索层（Portal 渲染到 body，避免 header transform 影响 fixed 定位） */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
          {/* 半透明虚化遮罩 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* 搜索面板 */}
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl border bg-popover shadow-2xl overflow-hidden">
            {/* 搜索输入框 */}
            <div className="flex items-center gap-3 p-4 border-b">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" strokeWidth={2.5} />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文章标题、摘要、标签…"
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-lg"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={() => setOpen(false)}
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* 搜索结果列表 */}
            <div className="max-h-[50vh] overflow-y-auto">
              {query.trim() === "" ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">输入关键词开始搜索</p>
                  <p className="text-xs mt-2">支持标题、摘要、标签搜索</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">没有找到相关文章</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => goPost(r as unknown as SearchPost)}
                        className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="font-semibold text-foreground truncate">
                            {r.title}
                          </h4>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(r.publishedAt ?? null)}
                          </span>
                        </div>
                        {r.summary && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {r.summary}
                          </p>
                        )}
                        {r.tags && r.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.tags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 底部提示 */}
            <div className="p-3 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Esc 关闭</span>
              <span>共 {posts.length} 篇文章</span>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
