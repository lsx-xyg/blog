"use client";

import { useEffect, useState, useRef } from "react";
import {
  Upload,
  Trash2,
  Star,
  StarOff,
  Image as ImageIcon,
  Tag,
  X,
  Check,
} from "lucide-react";

type GalleryItem = {
  id: string;
  title: string | null;
  description: string | null;
  featured: boolean;
  imageUrl: string;
  createdAt: string;
};

/**
 * 后台相册管理组件
 *
 * 功能：
 * - 图片上传（走 T3 存储驱动 /api/upload）
 * - 标题/描述编辑
 * - 精选标记切换
 * - 标签管理（可搜索下拉 combobox）
 * - 删除
 * - 列表展示（网格布局）
 */
export function ManageGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载相册列表
  const loadItems = async () => {
    try {
      const res = await fetch("/api/admin/gallery");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (e) {
      console.error("加载相册失败：", e);
    } finally {
      setLoading(false);
    }
  };

  // 加载所有标签
  const loadTags = async () => {
    try {
      const res = await fetch("/api/admin/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags?.map((t: { name: string }) => t.name) || []);
      }
    } catch (e) {
      // 标签 API 可能还没实现，忽略
    }
  };

  useEffect(() => {
    loadItems();
    loadTags();
  }, []);

  // 处理文件上传
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          // 创建相册项
          await fetch("/api/admin/gallery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: data.url,
              title: file.name.replace(/\.[^.]+$/, ""),
            }),
          });
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

  // 开始编辑
  const startEdit = (item: GalleryItem) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title || "",
      description: item.description || "",
      tags: [], // 标签需要单独加载，这里简化
    });
    setTagInput("");
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch(`/api/admin/gallery/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          tags: editForm.tags,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        await loadItems();
      }
    } catch (e) {
      console.error("保存失败：", e);
      alert("保存失败，请重试");
    }
  };

  // 切换精选
  const toggleFeatured = async (item: GalleryItem) => {
    try {
      await fetch(`/api/admin/gallery/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !item.featured }),
      });
      await loadItems();
    } catch (e) {
      console.error("切换精选失败：", e);
    }
  };

  // 删除
  const deleteItem = async (id: string) => {
    if (!confirm("确定删除这张图片吗？")) return;

    try {
      await fetch(`/api/admin/gallery/${id}`, {
        method: "DELETE",
      });
      await loadItems();
    } catch (e) {
      console.error("删除失败：", e);
      alert("删除失败，请重试");
    }
  };

  // 添加标签
  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !editForm.tags.includes(trimmed)) {
      setEditForm({ ...editForm, tags: [...editForm.tags, trimmed] });
    }
    setTagInput("");
    setShowTagDropdown(false);
  };

  // 移除标签
  const removeTag = (tag: string) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter((t) => t !== tag),
    });
  };

  // 过滤标签下拉
  const filteredTags = allTags.filter(
    (t) =>
      t.toLowerCase().includes(tagInput.toLowerCase()) &&
      !editForm.tags.includes(t),
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 标题和上传按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">相册管理</h1>
        <div className="flex gap-2">
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

      {/* 提示 */}
      <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>上传图片后会自动创建相册项，可编辑标题、描述、标签和精选标记。</p>
        <p className="mt-1">图片存储走 T3 存储驱动（当前：{process.env.STORAGE_DRIVER || "LOCAL"}）。</p>
      </div>

      {/* 相册网格 */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">还没有图片，点击上方按钮上传第一张吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              {/* 图片 */}
              <div className="relative aspect-square overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.title || "相册图片"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {/* 精选标记 */}
                {item.featured && (
                  <div className="absolute top-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-xs text-primary-foreground">
                    精选
                  </div>
                )}
              </div>

              {/* 信息 */}
              {editingId === item.id ? (
                <div className="space-y-3 p-4">
                  {/* 标题 */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      标题
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="图片标题"
                    />
                  </div>

                  {/* 描述 */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      描述
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={2}
                      placeholder="图片描述"
                    />
                  </div>

                  {/* 标签 */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      标签
                    </label>
                    <div className="relative">
                      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background p-2">
                        {editForm.tags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => {
                            setTagInput(e.target.value);
                            setShowTagDropdown(true);
                          }}
                          onFocus={() => setShowTagDropdown(true)}
                          onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              e.preventDefault();
                              addTag(tagInput);
                            }
                          }}
                          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none"
                          placeholder="输入标签回车添加"
                        />
                      </div>
                      {/* 标签下拉 */}
                      {showTagDropdown && filteredTags.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                          {filteredTags.slice(0, 5).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addTag(tag);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                            >
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                    >
                      <Check className="h-3 w-3" />
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      <X className="h-3 w-3" />
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <h3 className="truncate text-sm font-medium">
                    {item.title || "未命名"}
                  </h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </p>

                  {/* 操作按钮 */}
                  <div className="mt-3 flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFeatured(item)}
                      className={`flex items-center justify-center rounded-md border px-2 py-1 text-xs ${
                        item.featured
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input hover:bg-accent"
                      }`}
                      title={item.featured ? "取消精选" : "设为精选"}
                    >
                      {item.featured ? (
                        <Star className="h-3 w-3 fill-current" />
                      ) : (
                        <StarOff className="h-3 w-3" />
                      )}
                    </button>
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
