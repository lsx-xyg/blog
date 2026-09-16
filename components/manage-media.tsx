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
  Edit3,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminModal } from "@/components/admin/modal";
import { AdminLoadingState, AdminEmptyState } from "@/components/admin/status";
import { MediaType, MEDIA_TYPE_LABELS } from "@/lib/types/media";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSearchInput } from "@/components/admin/search-input";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/tag-input";
import { StorageDriverType } from "@/lib/types/storage";

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
  featured: boolean | null; // 相册精选状态（非相册为 null）
};

/**
 * 后台媒体库管理组件
 *
 * 功能：
 * - 图片上传（按类型：文章图片/相册图片）
 * - 按类型筛选（全部/文章图片/相册图片）
 * - 搜索
 * - 分页
 * - 相册图片：编辑信息（标题/描述）+ 设置精选
 * - 图片放大查看（灯箱）
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [showUnusedCleanup, setShowUnusedCleanup] = useState(false);
  const [unusedItems, setUnusedItems] = useState<MediaItem[]>([]);
  const [unusedLoading, setUnusedLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 编辑弹窗状态
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFeatured, setEditFeatured] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // 灯箱状态
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>("");

  // 当前存储驱动
  const [currentDriver, setCurrentDriver] = useState<StorageDriverType>(StorageDriverType.LOCAL);

  // 加载当前存储驱动
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.storage?.driver) {
          setCurrentDriver(data.storage.driver);
        }
      })
      .catch(() => {});
  }, []);

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
  /** 选择文件后暂存（弹窗内确认再上传） */
  const pickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadFiles((prev) => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePickedFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of uploadFiles) {
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
      setUploadFiles([]);
      setUploadOpen(false);
    } catch (e) {
      console.error("上传失败：", e);
      alert("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  // 删除确认对话框受控状态
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  // 删除
  const deleteItem = async (id: string) => {
    setConfirmState({
      title: "删除这张图片",
      description: "存储中的文件也会被删除。",
      onConfirm: async () => {
        setConfirmState(null);
        await doDeleteItem(id);
      },
    });
  };

  const doDeleteItem = async (id: string) => {
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

  // 打开编辑弹窗（加载媒体标签和所有标签）
  const openEditModal = async (item: MediaItem) => {
    setEditingItem(item);
    setEditSaving(false);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
    setEditFeatured(item.featured ?? false);
    setEditTags([]);

    // 并行加载：媒体的标签 + 所有已有标签（用于下拉提示）
    try {
      const [mediaTagsRes, allTagsRes] = await Promise.all([
        fetch(`/api/admin/media/${item.id}/tags`),
        fetch("/api/admin/tags"),
      ]);

      if (mediaTagsRes.ok) {
        const data = await mediaTagsRes.json();
        setEditTags((data.tags || []).map((t: { name: string }) => t.name));
      }

      if (allTagsRes.ok) {
        const data = await allTagsRes.json();
        setAllTags(data.tags || []);
      }
    } catch (e) {
      console.error("加载标签失败：", e);
    }
  };

  // 保存编辑（更新 media 表 + 标签）
  const saveEdit = async () => {
    if (!editingItem) return;
    setEditSaving(true);

    try {
      // 构建更新数据：文章图片不传 featured（保持默认 false）
      const updateData: Record<string, unknown> = {
        title: editTitle || null,
        description: editDescription || null,
      };
      // 只有相册图片才更新 featured
      if (editingItem.type === MediaType.GALLERY) {
        updateData.featured = editFeatured;
      }

      // 1. 保存基本信息
      const res = await fetch(`/api/admin/media/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        alert("保存基本信息失败，请重试");
        return;
      }

      // 2. 保存标签
      const tagsRes = await fetch(`/api/admin/media/${editingItem.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: editTags }),
      });

      if (!tagsRes.ok) {
        alert("保存标签失败，请重试");
        return;
      }

      setEditingItem(null);
      await loadItems();
    } catch (e) {
      console.error("保存失败：", e);
      alert("保存失败，请重试");
    } finally {
      setEditSaving(false);
    }
  };

  // 打开灯箱
  const openLightbox = (url: string, title: string) => {
    setLightboxUrl(url);
    setLightboxTitle(title);
  };

  // 关闭灯箱
  const closeLightbox = () => {
    setLightboxUrl(null);
    setLightboxTitle("");
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
    setConfirmState({
      title: `删除 ${unusedItems.length} 张未使用的图片`,
      description: "此操作不可恢复。",
      onConfirm: async () => {
        setConfirmState(null);
        await doCleanupUnusedMedia();
      },
    });
  };

  const doCleanupUnusedMedia = async () => {
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
    <div className="animate-page-enter">
      <AdminPageHeader
        title="媒体库"
        titleExtra={
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {currentDriver === StorageDriverType.LOCAL ? "本地存储" : currentDriver === StorageDriverType.GITHUB ? "GitHub 图床" : "S3 存储"}
          </span>
        }
        actions={
          <>
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
            <span className="hidden sm:inline">清理未使用</span>
          </button>
          {/* 上传图片（弹窗内先选类型再选文件） */}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">上传图片</span>
          </button>
          {/* 刷新按钮 */}
          <button
            type="button"
            onClick={loadItems}
            className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
            title="刷新列表"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">刷新</span>
          </button>
          </>
        }
      />

      {/* 未使用图片清理面板（动画展开/收起） */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          showUnusedCleanup ? "grid-rows-[1fr] opacity-100 mb-6" : "grid-rows-[0fr] opacity-0 mb-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
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
                  className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${unusedLoading ? "animate-spin" : ""}`} />
                  刷新
                </button>
                <button
                  type="button"
                  onClick={cleanupUnusedMedia}
                  disabled={unusedItems.length === 0}
                  className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
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
                  <div key={item.id} className="relative aspect-square overflow-hidden rounded border animate-fade-in-up">
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
        </div>
      </div>

      {/* 工具行：搜索 + 筛选（搜索在前、筛选在后） */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AdminSearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="搜索图片标题或 URL…"
          className="w-full max-w-md"
        />
        {/* 类型筛选（下拉框统一） */}
        <div className="ml-auto flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as MediaType | "ALL"); setPage(1); }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">全部图片</option>
            <option value={MediaType.ARTICLE}>{MEDIA_TYPE_LABELS[MediaType.ARTICLE]}</option>
            <option value={MediaType.GALLERY}>{MEDIA_TYPE_LABELS[MediaType.GALLERY]}</option>
          </select>
        </div>
      </div>

      {/* 媒体网格（key 变化时触发切换动画） */}
      {loading ? (
        <AdminLoadingState variant="grid" />
      ) : items.length === 0 ? (
        <div key={`empty-${typeFilter}-${search}`}>
          <AdminEmptyState
            icon={<ImageIcon className="h-12 w-12" />}
            title="还没有图片"
            description="点击上方按钮上传第一张吧"
          />
        </div>
      ) : (
        <>
          <div
            key={`grid-${typeFilter}-${search}-${page}`}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 animate-fade-in-up"
          >
            {items.map((item, index) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* 图片 */}
                <div
                  className="relative aspect-square overflow-hidden bg-muted cursor-zoom-in"
                  onClick={() => openLightbox(item.url, item.title || "媒体图片")}
                >
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
                  {/* 放大图标（hover 显示） */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                  </div>
                </div>

                {/* 信息 */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate text-sm font-medium flex-1">
                      {item.title || "未命名"}
                    </h3>
                    {/* 相册图片显示精选标记（只有真正精选的才显示） */}
                    {item.type === MediaType.GALLERY && item.featured === true && (
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 ml-1 flex-shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatSize(item.size)} · {item.storageDriver}
                  </p>

                  {/* 操作按钮 */}
                  <div className="mt-3 flex gap-1">
                    {/* 编辑按钮（所有图片都可以编辑：标题/描述/标签，相册图片还可以编辑精选） */}
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent transition-colors"
                      title={item.type === MediaType.GALLERY ? "编辑信息/精选/标签" : "编辑信息/标签"}
                    >
                      <Edit3 className="h-3 w-3" />
                      编辑
                    </button>
                    {/* 删除 */}
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="flex items-center justify-center rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
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
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent transition-all duration-200 hover:scale-105 active:scale-95"
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
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent transition-all duration-200 hover:scale-105 active:scale-95"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 编辑弹窗 */}
      {editingItem && (
        <AdminModal
          open={!!editingItem}
          title="编辑相册图片"
          onClose={() => !editSaving && setEditingItem(null)}
          closeDisabled={editSaving}
          maxWidth="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                disabled={editSaving}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {editSaving ? "保存中…" : "保存"}
              </button>
            </>
          }
        >
            <div className="space-y-4">
                {/* 预览图 */}
                <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingItem.url}
                    alt={editingItem.title || "预览"}
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* 标题 */}
                <div>
                  <label className="mb-1 block text-sm font-medium">标题</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="输入图片标题"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* 描述 */}
                <div>
                  <label className="mb-1 block text-sm font-medium">描述</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="输入图片描述"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* 标签（文章图片和相册图片都可以编辑） */}
                <div>
                  <label className="mb-1 block text-sm font-medium">标签</label>
                  <TagInput
                    value={editTags}
                    onChange={setEditTags}
                    allTags={allTags}
                    placeholder="输入标签后回车添加，可选择已有标签"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">回车添加新标签，输入时可选择已有标签</p>
                </div>

                {/* 精选开关（仅相册图片显示，文章图片默认 false） */}
                {editingItem.type === MediaType.GALLERY && (
                  <div className="flex items-center justify-between rounded-lg border border-input p-3">
                    <div className="flex items-center gap-2">
                      <Star className={`h-4 w-4 ${editFeatured ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium">设为精选</span>
                    </div>
                    <Switch
                      checked={editFeatured}
                      onCheckedChange={(checked) => setEditFeatured(checked)}
                    />
                  </div>
                )}

            </div>
        </AdminModal>
      )}

      {/* 灯箱（图片放大查看） */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={closeLightbox}
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {/* 标题 */}
          <div className="absolute top-4 left-4 text-white text-sm opacity-80">
            {lightboxTitle}
          </div>

          {/* 图片 */}
          <img
            src={lightboxUrl}
            alt={lightboxTitle}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 上传图片弹窗：先选类型，再选文件 */}
      {uploadOpen && (
        <AdminModal
          open
          title="上传图片"
          onClose={() => { if (!uploading) { setUploadOpen(false); setUploadFiles([]); } }}
          maxWidth="md"
          closeOnBackdrop={!uploading}
          footer={
            <>
              <button
                type="button"
                onClick={() => { setUploadOpen(false); setUploadFiles([]); }}
                disabled={uploading}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleFileUpload}
                disabled={uploading || uploadFiles.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploading ? `上传中（${uploadFiles.length} 张）…` : `开始上传（${uploadFiles.length} 张）`}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* 上传类型选择（单选切换） */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">上传到</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUploadType(MediaType.ARTICLE)}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-all ${
                    uploadType === MediaType.ARTICLE
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {MEDIA_TYPE_LABELS[MediaType.ARTICLE]}
                  <span className="mt-0.5 block text-xs text-muted-foreground">用作文章配图</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType(MediaType.GALLERY)}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-all ${
                    uploadType === MediaType.GALLERY
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {MEDIA_TYPE_LABELS[MediaType.GALLERY]}
                  <span className="mt-0.5 block text-xs text-muted-foreground">加入相册</span>
                </button>
              </div>
            </div>

            {/* 选择文件 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">选择图片</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                点击选择图片（可多选）
              </button>
              {uploadFiles.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {uploadFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-xs">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="shrink-0 text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => removePickedFile(index)}
                        disabled={uploading}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        aria-label="移除"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </AdminModal>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmLabel="删除"
        onConfirm={confirmState?.onConfirm ?? (() => {})}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
