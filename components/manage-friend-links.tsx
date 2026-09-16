"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit3, Link2, RefreshCw, X } from "lucide-react";
import { AdminLoadingState, AdminEmptyState } from "@/components/admin/status";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminModal } from "@/components/admin/modal";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSearchInput } from "@/components/admin/search-input";

type FriendLink = {
  id: string;
  name: string;
  url: string;
  avatarUrl: string | null;
  description: string;
  tags: string[];
  sortOrder: number;
  createdAt: string;
};

const emptyForm = {
  name: "",
  url: "",
  avatarUrl: "",
  description: "",
  tags: "",
  sortOrder: 0,
};

/**
 * 后台友链管理组件
 *
 * 功能：
 * - 友链列表（按 sort_order 排序）
 * - 创建/编辑/删除友链
 * - 表单弹窗
 */
export function ManageFriendLinks() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // 搜索过滤（名称/链接/描述）
  const filteredLinks = useMemo(() => {
    if (!search) return links;
    const kw = search.toLowerCase();
    return links.filter(
      (l) =>
        l.name.toLowerCase().includes(kw) ||
        l.url.toLowerCase().includes(kw) ||
        (l.description || "").toLowerCase().includes(kw),
    );
  }, [links, search]);

  // 加载友链列表
  const loadLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/friend-links");
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
      }
    } catch (e) {
      console.error("加载友链失败：", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  // 打开创建弹窗
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  // 打开编辑弹窗
  const openEdit = (link: FriendLink) => {
    setEditingId(link.id);
    setForm({
      name: link.name,
      url: link.url,
      avatarUrl: link.avatarUrl ?? "",
      description: link.description,
      tags: link.tags.join(", "),
      sortOrder: link.sortOrder,
    });
    setShowModal(true);
  };

  // 保存友链
  const saveLink = async () => {
    if (!form.name || !form.url) {
      alert("名称和链接不能为空");
      return;
    }

    setSaving(true);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const body = {
        name: form.name,
        url: form.url,
        avatarUrl: form.avatarUrl || null,
        description: form.description,
        tags,
        sortOrder: Number(form.sortOrder) || 0,
      };

      const url = editingId
        ? `/api/admin/friend-links/${editingId}`
        : "/api/admin/friend-links";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        await loadLinks();
      } else {
        alert("保存失败，请重试");
      }
    } catch (e) {
      console.error("保存友链失败：", e);
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  // 删除友链（确认对话框受控状态）
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  const deleteLink = async (id: string, name: string) => {
    setConfirmState({
      title: `删除友链「${name}」`,
      onConfirm: async () => {
        setConfirmState(null);
        await doDeleteLink(id);
      },
    });
  };

  const doDeleteLink = async (id: string) => {

    try {
      const res = await fetch(`/api/admin/friend-links/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadLinks();
      } else {
        alert("删除失败，请重试");
      }
    } catch (e) {
      console.error("删除友链失败：", e);
      alert("删除失败，请重试");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const labelClass = "block text-sm font-medium mb-1.5";

  return (
    <div className="animate-page-enter">
      <AdminPageHeader
        title="友链管理"
        description={`共 ${links.length} 个友链`}
        actions={
          <>
            <button
              type="button"
              onClick={loadLinks}
              className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              添加友链
            </button>
          </>
        }
      />

      {/* 搜索 */}
      <AdminSearchInput
        value={search}
        onChange={setSearch}
        placeholder="搜索友链名称、链接或描述…"
        className="mb-4 max-w-md"
      />

      {/* 友链列表 */}
      {loading ? (
        <AdminLoadingState />
      ) : filteredLinks.length === 0 ? (
        <AdminEmptyState
          icon={<Link2 className="h-12 w-12" />}
          title={search ? "没有找到匹配的友链" : "还没有友链"}
          description={search ? undefined : "点击右上角添加"}
        />
      ) : (
        <>
        {/* 桌面端：表格（与其他管理页统一样式） */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">链接</th>
                <th className="px-4 py-3 text-left text-sm font-medium">标签</th>
                <th className="px-4 py-3 text-center text-sm font-medium">排序</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.map((link, index) => (
                <tr
                  key={link.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {link.avatarUrl ? (
                        <img
                          src={link.avatarUrl}
                          alt={link.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{link.name}</p>
                        {link.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{link.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline truncate block max-w-xs"
                    >
                      {link.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {link.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-muted-foreground">{link.sortOrder}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(link)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="编辑"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLink(link.id, link.name)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 移动端：卡片列表 */}
        <div className="md:hidden rounded-xl border border-border bg-surface divide-y divide-border">
          {filteredLinks.map((link, index) => (
            <div key={link.id} className="p-4 animate-fade-in-up" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {link.avatarUrl ? (
                    <img src={link.avatarUrl} alt={link.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-full bg-muted flex items-center justify-center">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{link.name}</p>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-primary hover:underline">
                      {link.url}
                    </a>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">排序 {link.sortOrder}</span>
              </div>
              {link.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {link.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {link.description && <p className="mt-2 text-xs text-muted-foreground">{link.description}</p>}
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => openEdit(link)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="编辑"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteLink(link.id, link.name)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* 表单弹窗 */}
      {showModal && (
        <AdminModal
          open
          title={editingId ? "编辑友链" : "添加友链"}
          onClose={() => setShowModal(false)}
          closeOnBackdrop={false}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveLink}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </>
          }
        >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>名称 *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                    placeholder="友链名称"
                  />
                </div>
                <div>
                  <label className={labelClass}>排序</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>链接 *</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={inputClass}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className={labelClass}>头像 URL（可选）</label>
                <input
                  type="url"
                  value={form.avatarUrl}
                  onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                  className={inputClass}
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              <div>
                <label className={labelClass}>描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputClass} min-h-[60px] resize-y`}
                  placeholder="一句话描述"
                />
              </div>
              <div>
                <label className={labelClass}>标签（用逗号分隔）</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className={inputClass}
                  placeholder="前端, 设计, 生活"
                />
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
