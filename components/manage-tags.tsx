"use client";

import { useEffect, useState } from "react";
import { Trash2, Tag, Pencil, AlertTriangle, X, FileText, Image, RefreshCw } from "lucide-react";
import { AdminModal } from "@/components/admin/modal";
import { AdminListPage } from "@/components/admin/list-page";
import { CreateButton, RefreshButton } from "@/components/admin/action-buttons";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

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

  // 新建 / 编辑弹窗状态
  const [editingTag, setEditingTag] = useState<{ id: string | null; name: string } | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState("");

  const openCreate = () => {
    setEditingTag({ id: null, name: "" });
    setTagName("");
    setTagError("");
  };

  const openEdit = (tag: TagWithCount) => {
    setEditingTag({ id: tag.id, name: tag.name });
    setTagName(tag.name);
    setTagError("");
  };

  const saveTag = async () => {
    const name = tagName.trim();
    if (!name) {
      setTagError("标签名称不能为空");
      return;
    }
    setTagSaving(true);
    setTagError("");
    try {
      const editingId = editingTag?.id ?? null;
      const res = await fetch(editingId ? `/api/admin/tags/${editingId}` : "/api/admin/tags", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingTag(null);
        await loadTags();
      } else {
        setTagError(data.error || "保存失败");
      }
    } catch (e) {
      console.error("保存标签失败：", e);
      setTagError("保存失败，请重试");
    } finally {
      setTagSaving(false);
    }
  };

  // 删除标签（确认对话框受控状态）
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  const deleteTag = async (id: string, name: string) => {
    setConfirmState({
      title: `删除标签「${name}」`,
      description: "关联的文章和图片标签会自动解除关联，但不会删除文章和图片本身。",
      onConfirm: async () => {
        setConfirmState(null);
        await doDeleteTag(id);
      },
    });
  };

  const doDeleteTag = async (id: string) => {
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
    <>
    <AdminListPage
      title="标签管理"
      description={`共 ${tags.length} 个标签 · ${totalPosts} 次文章引用 · ${totalMedia} 次图片引用`}
      actions={
        <>
          <CreateButton onClick={openCreate} label="新建标签" />
          <RefreshButton onClick={loadTags} loading={loading} />
        </>
      }
      search={{ value: search, onChange: setSearch, placeholder: "搜索标签..." }}
      loading={loading}
      empty={{
        icon: <Tag className="h-12 w-12" />,
        title: search ? "没有找到匹配的标签" : "还没有标签",
        description: search ? undefined : "发布文章或上传图片时会自动创建",
      }}
    >
      <>
          {/* 桌面端：表格 */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-surface">
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
              {/* 筛选变化时通过 key 重新挂载，触发入场动画 */}
              <tbody key={search}>
                {filteredTags.map((tag, index) => (
                  <tr
                    key={tag.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(tag)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTag(tag.id, tag.name)}
                          disabled={deletingId === tag.id}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 disabled:opacity-50"
                          title="删除"
                        >
                          {deletingId === tag.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端：卡片列表（筛选变化时重新挂载触发动画） */}
          <div key={search} className="md:hidden space-y-3">
            {filteredTags.map((tag, index) => (
              <div
                key={tag.id}
                className="rounded-xl border border-border bg-surface p-4 animate-fade-in-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* 数据区 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {tag.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono truncate">{tag.slug}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {tag.postCount} 篇
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Image className="h-3.5 w-3.5" />
                        {tag.mediaCount} 张
                      </span>
                      <span className={`inline-flex items-center font-semibold ${tag.totalCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        共 {tag.totalCount}
                      </span>
                    </div>
                  </div>
                </div>
                {/* 操作区：放数据下方 */}
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                  <button
                    type="button"
                    onClick={() => openEdit(tag)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="编辑"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTag(tag.id, tag.name)}
                    disabled={deletingId === tag.id}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 disabled:opacity-50"
                    title="删除"
                  >
                    {deletingId === tag.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
      </>
    </AdminListPage>

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

      {/* 新建 / 编辑标签弹窗 */}
      {editingTag && (
        <AdminModal
          open
          title={editingTag.id ? "编辑标签" : "新建标签"}
          onClose={() => setEditingTag(null)}
          maxWidth="md"
          closeOnBackdrop={!tagSaving}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingTag(null)}
                disabled={tagSaving}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveTag}
                disabled={tagSaving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {tagSaving ? "保存中…" : "保存"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">标签名称 *</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTag()}
                placeholder="如：前端开发"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                slug 会根据名称自动生成（冲突时自动加后缀），文章/图片引用标签名称，重命名后引用自动跟随。
              </p>
            </div>
            {tagError && <p className="text-sm text-destructive">{tagError}</p>}
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
    </>
  );
}
