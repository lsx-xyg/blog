"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Search,
  Image as ImageIcon,
  Loader2,
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

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, alt?: string) => void;
  defaultType?: MediaType | "ALL";
};

/**
 * 媒体库选择器组件
 *
 * 用于在文章编辑器中选择已有图片
 * - Tab 切换：上传新图片 / 从图库选择
 * - 从图库选择时支持按类型筛选（全部/文章图片/相册图片）
 * - 网格布局展示缩略图，点击选择
 * - 支持搜索和分页
 */
export function MediaPicker({ open, onClose, onSelect, defaultType = "ALL" }: MediaPickerProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "library">("library");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "ALL">(defaultType);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(24);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载媒体库
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
    if (open && activeTab === "library") {
      loadItems();
    }
  }, [open, activeTab, page, typeFilter, search]);

  // 处理文件上传
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", MediaType.ARTICLE); // 从编辑器上传默认是文章图片

        const res = await fetch("/api/admin/media", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const mediaRecord = await res.json();
          // 上传成功后自动选择
          onSelect(mediaRecord.url, mediaRecord.title || file.name);
          onClose();
          return;
        }
      }
    } catch (e) {
      console.error("上传失败：", e);
      alert("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  // 选择图片
  const handleSelect = (item: MediaItem) => {
    onSelect(item.url, item.title || undefined);
    onClose();
  };

  if (!open) return null;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">插入图片</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "library"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            从图库选择
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "upload"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            上传新图片
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "upload" ? (
            /* 上传新图片 */
            <div className="flex flex-col items-center justify-center py-12">
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
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-12 py-8 hover:border-primary/50 hover:bg-accent/50 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-12 w-12 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  {uploading ? "上传中…" : "点击选择图片或拖拽到此处"}
                </span>
                <span className="text-xs text-muted-foreground">
                  支持 JPG / PNG / WebP / GIF，最大 10MB
                </span>
              </button>
              <p className="mt-4 text-xs text-muted-foreground">
                从文章编辑器上传的图片会自动标记为「{MEDIA_TYPE_LABELS[MediaType.ARTICLE]}」
              </p>
            </div>
          ) : (
            /* 从图库选择 */
            <div className="space-y-4">
              {/* 筛选和搜索 */}
              <div className="flex flex-wrap items-center gap-3">
                {/* 类型筛选 */}
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

                {/* 搜索 */}
                <div className="relative flex-1 min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="搜索图片…"
                    className="w-full rounded-lg border border-input bg-background py-1.5 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>

              {/* 图片网格 */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">没有找到图片</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border hover:border-primary transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.title || "媒体图片"}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* 类型标签 */}
                        <div className="absolute top-1 left-1">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              item.type === MediaType.ARTICLE
                                ? "bg-blue-500/90 text-white"
                                : "bg-purple-500/90 text-white"
                            }`}
                          >
                            {item.type === MediaType.ARTICLE ? "文" : "相"}
                          </span>
                        </div>
                        {/* 悬浮遮罩 */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-sm font-medium">点击选择</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-50 hover:bg-accent"
                      >
                        上一页
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-50 hover:bg-accent"
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
