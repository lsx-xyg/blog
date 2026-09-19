"use client";

/**
 * 后台备份管理组件（T13）
 *
 * 功能：
 * 1. 查看备份列表
 * 2. 手动创建备份
 * 3. 下载备份
 * 4. 删除备份
 * 5. 恢复备份（上传 JSON 文件）
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Trash2, RefreshCw, Upload } from "lucide-react";
import { AdminListPage } from "@/components/admin/list-page";
import { CreateButton, RefreshButton } from "@/components/admin/action-buttons";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/toast";

interface BackupRecord {
  id: string;
  fileKey: string;
  size: number;
  triggeredBy: "MANUAL" | "AUTO";
  createdAt: string;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 格式化时间 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ManageBackup() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 确认对话框状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [restoreInputRef, setRestoreInputRef] = useState<HTMLInputElement | null>(null);

  const { showToast } = useToast();

  /** 加载备份列表 */
  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (e) {
      showToast("加载备份列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /** 创建备份 */
  const handleCreate = useCallback(async () => {
    try {
      setCreating(true);
      const res = await fetch("/api/admin/backup", { method: "POST" });
      if (!res.ok) throw new Error("创建失败");
      const data = await res.json();
      showToast("备份创建成功", "success");
      await loadBackups();
    } catch (e) {
      showToast("创建备份失败", "error");
    } finally {
      setCreating(false);
    }
  }, [loadBackups, showToast]);

  /** 下载备份 */
  const handleDownload = useCallback((id: string) => {
    // 直接在新窗口打开下载链接
    window.open(`/api/admin/backup/${id}`, "_blank");
  }, []);

  /** 删除备份（打开确认对话框） */
  const handleDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
    setDeleteConfirmOpen(true);
  }, []);

  /** 确认删除备份 */
  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    try {
      setDeletingId(pendingDeleteId);
      const res = await fetch(`/api/admin/backup/${pendingDeleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      showToast("备份删除成功", "success");
      await loadBackups();
    } catch (e) {
      showToast("删除备份失败", "error");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
      setDeleteConfirmOpen(false);
    }
  }, [pendingDeleteId, loadBackups, showToast]);

  /** 恢复备份（打开确认对话框） */
  const handleRestore = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 保存待恢复的文件，打开确认对话框
      setPendingRestoreFile(file);
      setRestoreConfirmOpen(true);
    },
    [],
  );

  /** 确认恢复备份 */
  const confirmRestore = useCallback(async () => {
    if (!pendingRestoreFile) return;
    try {
      setRestoring(true);
      const formData = new FormData();
      formData.append("file", pendingRestoreFile);

      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "恢复失败");
      }

      showToast("数据恢复成功", "success");
      await loadBackups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "恢复备份失败", "error");
    } finally {
      setRestoring(false);
      setPendingRestoreFile(null);
      setRestoreConfirmOpen(false);
      // 清空 input 的值，允许再次选择同一个文件
      if (restoreInputRef) {
        restoreInputRef.value = "";
      }
    }
  }, [pendingRestoreFile, restoreInputRef, loadBackups, showToast]);

  /** 取消恢复 */
  const cancelRestore = useCallback(() => {
    setPendingRestoreFile(null);
    setRestoreConfirmOpen(false);
    // 清空 input 的值
    if (restoreInputRef) {
      restoreInputRef.value = "";
    }
  }, [restoreInputRef]);

  // 初始加载
  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  return (
    <>
    <AdminListPage
      title="备份管理"
      description="管理数据库备份，支持手动创建、下载、删除和恢复"
      actions={
        <>
          <CreateButton onClick={handleCreate} label={creating ? "创建中…" : "创建备份"} disabled={creating} />
          <div className="relative">
            <input
              ref={setRestoreInputRef}
              type="file"
              accept=".json"
              onChange={handleRestore}
              disabled={restoring}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled={restoring}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{restoring ? "恢复中…" : "恢复备份"}</span>
            </button>
          </div>
          <RefreshButton onClick={loadBackups} loading={loading} />
        </>
      }
      loading={loading}
      empty={
        backups.length === 0 ? {
          title: "暂无备份", description: "点击右上角「创建备份」开始"
        } : null
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">备份列表</h2>
          <span className="text-xs text-muted-foreground">共 {backups.length} 个备份</span>
        </div>
            {/* 桌面表格 */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">备份文件</th>
                    <th className="w-20 px-4 py-3 text-left text-sm font-medium text-muted-foreground">类型</th>
                    <th className="w-24 px-4 py-3 text-right text-sm font-medium text-muted-foreground">大小</th>
                    <th className="w-44 px-4 py-3 text-left text-sm font-medium text-muted-foreground">创建时间</th>
                    <th className="w-24 px-4 py-3 text-right text-sm font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="block max-w-[320px] truncate font-medium text-sm">
                          {backup.fileKey.split("/").pop()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${
                            backup.triggeredBy === "AUTO"
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {backup.triggeredBy === "AUTO" ? "自动" : "手动"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-fg-faint">
                        {formatSize(backup.size)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(backup.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownload(backup.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="下载"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(backup.id)}
                            disabled={deletingId === backup.id}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 disabled:opacity-50"
                            title="删除"
                          >
                            {deletingId === backup.id ? (
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
            {/* 移动卡片 */}
            <div className="md:hidden divide-y divide-border">
              {backups.map((backup, i) => (
                <div
                  key={backup.id}
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  className="animate-fade-in-up px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{backup.fileKey.split("/").pop()}</span>
                        <span
                          className={`inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${
                            backup.triggeredBy === "AUTO"
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {backup.triggeredBy === "AUTO" ? "自动" : "手动"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatSize(backup.size)} · {formatDate(backup.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(backup.id)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="下载"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(backup.id)}
                      disabled={deletingId === backup.id}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 disabled:opacity-50"
                      title="删除"
                    >
                      {deletingId === backup.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
      </div>
    </AdminListPage>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="确认删除备份"
        description="确定要删除这个备份吗？此操作不可恢复，删除后无法找回备份文件。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onClose={() => {
          setPendingDeleteId(null);
          setDeleteConfirmOpen(false);
        }}
      />

      {/* 恢复确认对话框 */}
      <ConfirmDialog
        open={restoreConfirmOpen}
        title="确认恢复备份"
        description={`确定要恢复备份 "${pendingRestoreFile?.name || ""}" 吗？这会清空当前所有数据并替换为备份数据，此操作不可恢复！建议先创建一个当前数据的备份。`}
        confirmLabel="恢复"
        onConfirm={confirmRestore}
        onClose={cancelRestore}
      />
    </>
  );
}
