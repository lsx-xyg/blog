"use client";

import { useEffect, useState } from "react";
import { Trash2, Search, Tag, FileText, Image, RefreshCw, AlertTriangle } from "lucide-react";

type TagWithCount = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  postCount: number;
  mediaCount: number;
  totalCount: number;
};

/**
 * 后台标签管理组件
 *
 * 功能：
 * - 显示所有标签列表（含文章数、图片数、总数）
 * - 搜索标签
 * - 删除标签（关联的文章/图片标签由外键 CASCADE 清理）
 * - 按使用数排序
 */
export function ManageTags() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 加载标签列表
  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tags?withCount=true");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (e) {
      console.error("加载标签失败：", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // 删除标签
  const deleteTag = async (id: string, name: string) => {
    if (!confirm(`确定删除标签「${name}」吗？\n\n关联的文章和图片标签会自动解除关联，但不会删除文章和图片本身。`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/tags/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadTags();
      } else {
        alert("删除失败，请重试");
      }
    } catch (e) {
      console.error("删除标签失败：", e);
      alert("删除失败，请重试");
    } finally {
      setDeletingId(null);
    }
  };

  // 过滤标签
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase()),
  );

  // 统计
  const totalPosts = tags.reduce((sum, t) => sum + t.postCount, 0);
  const totalMedia = tags.reduce((sum, t) => sum + t.mediaCount, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 标题和操作 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">标签管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {tags.length} 个标签 · {totalPosts} 次文章引用 · {totalMedia} 次图片引用
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTags}
            className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标签..."
          className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* 标签列表 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">加载中…</div>
      ) : filteredTags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center animate-fade-in-up">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {search ? "没有找到匹配的标签" : "还没有标签，发布文章或上传图片时会自动创建"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">标签名称</th>
                <th className="px-4 py-3 text-center text-sm font-medium">文章数</th>
                <th className="px-4 py-3 text-center text-sm font-medium">图片数</th>
                <th className="px-4 py-3 text-center text-sm font-medium">总引用</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag, index) => (
                <tr
                  key={tag.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {tag.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{tag.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {tag.postCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Image className="h-3.5 w-3.5 text-muted-foreground" />
                      {tag.mediaCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${tag.totalCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {tag.totalCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteTag(tag.id, tag.name)}
                      disabled={deletingId === tag.id}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === tag.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 提示 */}
      {tags.length > 0 && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-4">
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">删除标签说明</p>
            <p className="mt-1">删除标签只会解除标签与文章/图片的关联，<strong>不会删除文章和图片本身</strong>。如果标签被大量使用，建议谨慎操作。</p>
          </div>
        </div>
      )}
    </div>
  );
}
