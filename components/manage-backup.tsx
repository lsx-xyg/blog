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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
    <div className="space-y-6 animate-page-enter">
      {/* 页面标题 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">备份管理</h1>
          <p className="text-muted-foreground mt-1 text-sm">管理数据库备份，支持手动创建、下载、删除和恢复</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCreate} disabled={creating} size="sm">
            {creating ? "创建中..." : "创建备份"}
          </Button>
          <div className="relative">
            <input
              ref={setRestoreInputRef}
              type="file"
              accept=".json"
              onChange={handleRestore}
              disabled={restoring}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <Button variant="outline" disabled={restoring} size="sm">
              {restoring ? "恢复中..." : "恢复备份"}
            </Button>
          </div>
          <Button variant="ghost" onClick={loadBackups} disabled={loading} size="sm">
            刷新
          </Button>
        </div>
      </div>

      {/* 说明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">备份说明</CardTitle>
          <CardDescription>
            备份包含所有业务数据（文章、标签、媒体、设置、友链、用户等），以 JSON 格式存储。
            定时备份由 cron-job.org 或 node-cron 触发，自动上传到配置的存储驱动。
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 备份列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">备份列表</CardTitle>
          <CardDescription>共 {backups.length} 个备份</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无备份，点击"创建备份"开始
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{backup.fileKey.split("/").pop()}</span>
                      <Badge variant={backup.triggeredBy === "AUTO" ? "secondary" : "default"} className="text-xs">
                        {backup.triggeredBy === "AUTO" ? "自动" : "手动"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatSize(backup.size)} · {formatDate(backup.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(backup.id)}>
                      下载
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(backup.id)}
                      disabled={deletingId === backup.id}
                    >
                      {deletingId === backup.id ? "删除中..." : "删除"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="确认删除备份"
        description="确定要删除这个备份吗？此操作不可恢复，删除后无法找回备份文件。"
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDeleteId(null);
          setDeleteConfirmOpen(false);
        }}
      />

      {/* 恢复确认对话框 */}
      <ConfirmDialog
        open={restoreConfirmOpen}
        title="确认恢复备份"
        description={`确定要恢复备份 "${pendingRestoreFile?.name || ""}" 吗？这会清空当前所有数据并替换为备份数据，此操作不可恢复！建议先创建一个当前数据的备份。`}
        confirmText="恢复"
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmRestore}
        onCancel={cancelRestore}
      />
    </div>
  );
}
