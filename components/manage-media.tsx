"use client";

import { useEffect, useState, useRef } from "react";
import {
  Upload,
  Trash2,
  Search,
  Image as ImageIcon,
  Filter,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { MediaType, MEDIA_TYPE_LABELS } from "@/lib/types/media";

type MediaItem = {
  id: string;
  type: string;
  url: string;
  storageDriver: string;
  storageKey: string | null;
  title: string | null;
  description: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

/**
 * 后台媒体库管理组件
 *
 * 功能：
 * - 图片上传（按类型：文章图片/相册图片）
 * - 按类型筛选（全部/文章图片/相册图片）
 * - 搜索
 * - 分页
 * - 修改类型（文章 ↔ 相册）
 * - 删除
 * - 未使用图片清理
 */
export function ManageMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [uploadType, setUploadType] = useState<MediaType>(MediaType.ARTICLE);
  const [showUnusedCleanup, setShowUnusedCleanup] = useState(false);
  const [unusedItems, setUnusedItems] = useState<MediaItem[]>([]);
  const [unusedLoading, setUnusedLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载媒体列表
  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/media?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("加载媒体库失败：", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [page, typeFilter, search]);

  // 处理文件上传
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", uploadType);

        const res = await fetch("/api/admin/media", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          alert(`上传失败：${error.error || "未知错误"}`);
        }
      }
      await loadItems();
    } catch (e) {
      console.error("上传失败：", e);
      alert("上传失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 修改类型
  const changeType = async (id: string, newType: MediaType) => {
    try {
      await fetch(`/api/admin/media/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType }),
      });
      await loadItems();
    } catch (e) {
      console.error("修改类型失败：", e);
    }
  };

  // 删除
  const deleteItem = async (id: string) => {
    if (!confirm("确定删除这张图片吗？存储中的文件也会被删除。")) return;

    try {
      await fetch(`/api/admin/media/${id}`, {
        method: "DELETE",
      });
      await loadItems();
    } catch (e) {
      console.error("删除失败：", e);
      alert("删除失败，请重试");
    }
  };

  // 加载未使用图片
  const loadUnusedMedia = async () => {
    setUnusedLoading(true);
    try {
      const res = await fetch("/api/admin/media/unused");
      if (res.ok) {
        const data = await res.json();
        setUnusedItems(data.items || []);
      }
    } catch (e) {
      console.error("加载未使用图片失败：", e);
    } finally {
      setUnusedLoading(false);
    }
  };

  // 批量删除未使用图片
  const cleanupUnusedMedia = async () => {
    if (!confirm(`确定删除 ${unusedItems.length} 张未使用的图片吗？此操作不可恢复。`)) return;

    try {
      await fetch("/api/admin/media/unused", {
        method: "DELETE",
      });
      setShowUnusedCleanup(false);
      setUnusedItems([]);
      await loadItems();
    } catch (e) {
      console.error("清理未使用图片失败：", e);
      alert("清理失败，请重试");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // 格式化文件大小
  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 标题和操作 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">媒体库</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* 未使用图片清理 */}
          <button
            type="button"
            onClick={() => {
              setShowUnusedCleanup(!showUnusedCleanup);
              if (!showUnusedCleanup) loadUnusedMedia();
            }}
            className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            清理未使用图片
          </button>

          {/* 上传类型选择 */}
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as MediaType)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={MediaType.ARTICLE}>{MEDIA_TYPE_LABELS[MediaType.ARTICLE]}</option>
            <option value={MediaType.GALLERY}>{MEDIA_TYPE_LABELS[MediaType.GALLERY]}</option>
          </select>

          {/* 上传按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "上传中…" : "上传图片"}
          </button>
        </div>
      </div>

      {/* 未使用图片清理面板 */}
      {showUnusedCleanup && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              未使用图片清理
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadUnusedMedia}
                disabled={unusedLoading}
                className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
              >
                <RefreshCw className={`h-3 w-3 ${unusedLoading ? "animate-spin" : ""}`} />
                刷新
              </button>
              <button
                type="button"
                onClick={cleanupUnusedMedia}
                disabled={unusedItems.length === 0}
                className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                全部删除 ({unusedItems.length})
              </button>
            </div>
          </div>
          {unusedLoading ? (
            <p className="text-sm text-muted-foreground">扫描中…</p>
          ) : unusedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有发现未使用的图片 🎉</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {unusedItems.slice(0, 12).map((item) => (
                <div key={item.id} className="relative aspect-square overflow-hidden rounded border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title || "未使用图片"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {unusedItems.length > 12 && (
                <div className="flex aspect-square items-center justify-center rounded border bg-muted text-sm text-muted-foreground">
                  +{unusedItems.length - 12}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 筛选和搜索 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* 类型筛选 */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => { setTypeFilter("ALL"); setPage(1); }}
              className={`px-3 py-1.5 text-sm transition-colors ${
                typeFilter === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => { setTypeFilter(MediaType.ARTICLE); setPage(1); }}
              className={`px-3 py-1.5 text-sm transition-colors ${
                typeFilter === MediaType.ARTICLE
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {MEDIA_TYPE_LABELS[MediaType.ARTICLE]}
            </button>
            <button
              type="button"
              onClick={() => { setTypeFilter(MediaType.GALLERY); setPage(1); }}
              className={`px-3 py-1.5 text-sm transition-colors ${
                typeFilter === MediaType.GALLERY
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {MEDIA_TYPE_LABELS[MediaType.GALLERY]}
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索图片标题或 URL…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* 媒体网格 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">还没有图片，点击上方按钮上传第一张吧</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-lg border border-border bg-card"
              >
                {/* 图片 */}
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title || "媒体图片"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* 类型标签 */}
                  <div className="absolute top-2 left-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.type === MediaType.ARTICLE
                          ? "bg-blue-500/90 text-white"
                          : "bg-purple-500/90 text-white"
                      }`}
                    >
                      {MEDIA_TYPE_LABELS[item.type as MediaType] || item.type}
                    </span>
                  </div>
                </div>

                {/* 信息 */}
                <div className="p-3">
                  <h3 className="truncate text-sm font-medium">
                    {item.title || "未命名"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatSize(item.size)} · {item.storageDriver}
                  </p>

                  {/* 操作按钮 */}
                  <div className="mt-3 flex gap-1">
                    {/* 切换类型 */}
                    <button
                      type="button"
                      onClick={() =>
                        changeType(
                          item.id,
                          item.type === MediaType.ARTICLE ? MediaType.GALLERY : MediaType.ARTICLE,
                        )
                      }
                      className="flex flex-1 items-center justify-center rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                      title={`转为${
                        item.type === MediaType.ARTICLE
                          ? MEDIA_TYPE_LABELS[MediaType.GALLERY]
                          : MEDIA_TYPE_LABELS[MediaType.ARTICLE]
                      }`}
                    >
                      转类型
                    </button>
                    {/* 删除 */}
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="flex items-center justify-center rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent"
              >
                上一页
              </button>
              <span className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 页（共 {total} 张）
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
