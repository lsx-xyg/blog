"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, Link2, RefreshCw, X } from "lucide-react";

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

  // 删除友链
  const deleteLink = async (id: string, name: string) => {
    if (!confirm(`确定删除友链「${name}」吗？`)) return;

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
    <div className="container mx-auto px-4 py-8">
      {/* 标题和操作 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">友链管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {links.length} 个友链</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLinks}
            className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            添加友链
          </button>
        </div>
      </div>

      {/* 友链列表 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">加载中…</div>
      ) : links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center animate-fade-in-up">
          <Link2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">还没有友链，点击右上角添加</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
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
              {links.map((link, index) => (
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
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent transition-colors"
                      >
                        <Edit3 className="h-3 w-3" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLink(link.id, link.name)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 表单弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 animate-fade-in-up">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "编辑友链" : "添加友链"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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

            <div className="mt-6 flex justify-end gap-2">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
