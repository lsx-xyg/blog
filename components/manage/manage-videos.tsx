'use client';

/**
 * 后台视频管理（S3 Step B2 完整版）
 *
 * 列表 + 分页 + 状态筛选；操作：上传（VideoUploadDialog）、编辑（VideoEditDialog）、
 * 发布/下架（PATCH status）、删除（ConfirmDialog + DELETE，封面按 isMediaReferenced 联动）。
 *
 * 删除提示语义（后端 DELETE 响应 posterDeleted）：
 * - true  →「视频和封面已删除」
 * - false →「视频已删除，封面仍被引用未删除」
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Archive, Clapperboard, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminListPage } from '@/components/admin/list-page';
import { CreateButton, RefreshButton } from '@/components/admin/action-buttons';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CleanupDialog } from '@/components/admin/cleanup-dialog';
import { useToast } from '@/components/ui/toast';
import { VideoStatus, VIDEO_STATUS_LABELS, VideoVisibility } from '@/lib/types/video';
import { formatDuration } from '@/lib/videos/shared/video';
import { VideoUploadDialog } from '@/components/videos/video-upload-dialog';
import { VideoEditDialog, type EditVideoPayload } from '@/components/videos/video-edit-dialog';
import type { OrphanPoster } from '@/lib/videos/server/orphans';
import Image from 'next/image';

type VideoItem = {
  id: string;
  title: string | null;
  description: string | null;
  url: string | null;
  posterUrl: string;
  posterMediaId: string | null;
  storageDriver: string;
  storageKey: string | null;
  mimeType: string | null;
  size: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  sortOrder: number;
  location: string | null;
  takenAt: string | null;
  tags: string[];
  createdAt: string;
};

/** 状态徽章配色（对齐其他管理页 status 徽章风格） */
const STATUS_STYLE: Record<VideoStatus, string> = {
  [VideoStatus.DRAFT]: 'bg-muted text-muted-foreground',
  [VideoStatus.PUBLISHED]: 'bg-green-500/10 text-green-600 dark:text-green-400',
  [VideoStatus.ARCHIVED]: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

/** 操作图标按钮统一样式 */
const actionBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

export function ManageVideos() {
  const { showToast } = useToast();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VideoStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(12);

  // 弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<VideoItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 孤儿封面清理状态（Phase 4 Step C3）
  const [orphanOpen, setOrphanOpen] = useState(false);
  const [orphanItems, setOrphanItems] = useState<OrphanPoster[]>([]);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanDeleting, setOrphanDeleting] = useState(false);
  const [orphanResults, setOrphanResults] = useState<
    { id: string; ok: boolean; reason?: string }[] | null
  >(null);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/videos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('加载视频失败：', e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const totalPages = Math.ceil(total / pageSize);

  /** 发布/下架切换 */
  const toggleStatus = async (v: VideoItem) => {
    const next = v.status === VideoStatus.PUBLISHED ? VideoStatus.ARCHIVED : VideoStatus.PUBLISHED;
    try {
      const res = await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(data?.error || '操作失败', 'error');
        return;
      }
      showToast(next === VideoStatus.PUBLISHED ? '已发布' : '已下架', 'success');
      loadVideos();
    } catch {
      showToast('网络异常，操作失败', 'error');
    }
  };

  /** 删除（后端按 isMediaReferenced 联动封面） */
  const handleDelete = async () => {
    if (!deletingVideo) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/videos/${deletingVideo.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(data?.error || '删除失败', 'error');
        return;
      }
      const data = (await res.json()) as { posterDeleted?: boolean };
      showToast(
        data.posterDeleted ? '视频和封面已删除' : '视频已删除，封面仍被引用未删除',
        'success',
      );
      setDeletingVideo(null);
      loadVideos();
    } catch {
      showToast('网络异常，删除失败', 'error');
    } finally {
      setDeleting(false);
    }
  };

  /** VideoItem → 编辑弹窗 payload */
  const toEditPayload = (v: VideoItem): EditVideoPayload => ({
    id: v.id,
    title: v.title,
    description: v.description,
    posterMediaId: v.posterMediaId,
    posterUrl: v.posterUrl,
    takenAt: v.takenAt,
    location: v.location,
    tags: v.tags ?? [],
    sortOrder: v.sortOrder ?? 0,
    visibility: v.visibility ?? VideoVisibility.PUBLIC,
    status: v.status,
  });

  /** 打开孤儿封面清理弹窗（拉取预览） */
  const openOrphans = async () => {
    setOrphanOpen(true);
    setOrphanLoading(true);
    setOrphanResults(null);
    try {
      const res = await fetch('/api/admin/media/orphans');
      if (res.ok) {
        const data = (await res.json()) as { items: OrphanPoster[] };
        setOrphanItems(data.items || []);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(data?.error || '扫描孤儿封面失败', 'error');
        setOrphanItems([]);
      }
    } catch {
      showToast('网络异常，扫描失败', 'error');
      setOrphanItems([]);
    } finally {
      setOrphanLoading(false);
    }
  };

  /** 确认删除孤儿封面（逐条结果显示） */
  const confirmOrphans = async () => {
    if (orphanItems.length === 0) return;
    setOrphanDeleting(true);
    try {
      const res = await fetch('/api/admin/media/orphans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orphanItems.map((o) => o.id) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(data?.error || '删除失败', 'error');
        return;
      }
      const data = (await res.json()) as {
        results: { id: string; ok: boolean; reason?: string }[];
        okCount: number;
        failCount: number;
      };
      setOrphanResults(data.results);
      // 部分失败时刷新列表，只显示还没删的（确认点 3）
      if (data.failCount > 0) {
        showToast(
          `删除 ${data.okCount} 个，${data.failCount} 个跳过（原因见列表）`,
          data.okCount > 0 ? 'success' : 'error',
        );
      } else {
        showToast(`已删除 ${data.okCount} 个孤儿封面`, 'success');
      }
      // 无论成功失败都刷新一次（孤儿集合已变化）
      loadVideos();
    } catch {
      showToast('网络异常，删除失败', 'error');
    } finally {
      setOrphanDeleting(false);
    }
  };

  /** 操作按钮组（桌面表格列 / 移动卡片操作行共用） */
  const renderActions = (v: VideoItem) => (
    <div className="flex items-center gap-1">
      <button type="button" title="编辑" className={actionBtn} onClick={() => setEditingVideo(v)}>
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={v.status === VideoStatus.PUBLISHED ? '下架' : '发布'}
        className={actionBtn}
        onClick={() => toggleStatus(v)}
      >
        {v.status === VideoStatus.PUBLISHED ? (
          <Archive className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        title="删除"
        className={`${actionBtn} hover:!text-destructive`}
        onClick={() => setDeletingVideo(v)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      <AdminListPage
        title="视频"
        description="个人生活视频相册。支持 mp4 / webm，上传后默认为草稿，发布后才在前台展示。"
        actions={
          <>
            <button
              type="button"
              onClick={() => void openOrphans()}
              title="清理孤儿封面（未被视频/文章引用的封面图片）"
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">清理孤儿封面</span>
            </button>
            <CreateButton
              onClick={() => setUploadOpen(true)}
              label="上传视频"
              icon={Plus}
              title="上传视频（mp4 / webm）"
            />
            <RefreshButton onClick={loadVideos} loading={loading} />
          </>
        }
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: '搜索视频标题…',
        }}
        filters={
          <div className="ml-auto flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as VideoStatus | 'ALL');
                setPage(1);
              }}
              className="shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">全部状态</option>
              {(Object.keys(VIDEO_STATUS_LABELS) as VideoStatus[]).map((s) => (
                <option key={s} value={s}>
                  {VIDEO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        }
        loading={loading}
        empty={
          items.length === 0
            ? {
                icon: <Clapperboard className="h-12 w-12" />,
                title: search || statusFilter !== 'ALL' ? '没有找到匹配的视频' : '还没有视频',
                description:
                  search || statusFilter !== 'ALL'
                    ? undefined
                    : '点击右上角「上传视频」上传第一条吧',
              }
            : null
        }
      >
        <>
          {/* 桌面端：表格（与其他管理页统一样式） */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    封面
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    标题
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    时长
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    大小
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    创建时间
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((v, rowIndex) => (
                  <tr
                    key={v.id}
                    className="border-b border-border/50 last:border-0 animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(rowIndex * 30, 300)}ms` }}
                  >
                    <td className="px-4 py-3">
                      {v.posterUrl ? (
                        <Image
                          src={v.posterUrl}
                          alt={v.title || '视频封面'}
                          width={96}
                          height={54}
                          className="h-12 w-20 rounded object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-12 w-20 items-center justify-center rounded bg-muted text-muted-foreground">
                          <Clapperboard className="h-5 w-5" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {v.title || '未命名视频'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatDuration(v.durationSeconds)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatSize(v.size)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[v.status]}`}
                      >
                        {VIDEO_STATUS_LABELS[v.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-right">{renderActions(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端：卡片列表（操作下沉模式） */}
          <div className="md:hidden rounded-xl border border-border bg-card divide-y divide-border">
            {items.map((v) => (
              <div key={v.id} className="p-4 animate-fade-in-up">
                <div className="flex items-center gap-3">
                  {v.posterUrl ? (
                    <Image
                      src={v.posterUrl}
                      alt={v.title || '视频封面'}
                      width={96}
                      height={54}
                      className="h-14 w-24 shrink-0 rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Clapperboard className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {v.title || '未命名视频'}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {formatDuration(v.durationSeconds)} · {formatSize(v.size)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[v.status]}`}
                      >
                        {VIDEO_STATUS_LABELS[v.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
                {/* 操作下沉（移动端） */}
                <div className="mt-3 flex justify-end border-t border-border/60 pt-2.5">
                  {renderActions(v)}
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
                第 {page} / {totalPages} 页（共 {total} 条）
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
      </AdminListPage>

      {/* 弹窗（移到 AdminListPage 外，与 ManageMedia 一致：避免空态/加载时 children 被替换导致弹窗不渲染） */}
      {/* 上传 / 编辑 / 删除确认 */}
      <VideoUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={loadVideos}
      />
      <VideoEditDialog
        open={editingVideo !== null}
        video={editingVideo ? toEditPayload(editingVideo) : null}
        onClose={() => setEditingVideo(null)}
        onSaved={loadVideos}
      />
      <ConfirmDialog
        open={deletingVideo !== null}
        title="删除视频"
        description={
          <>
            确定删除「{deletingVideo?.title || '未命名视频'}」吗？
            视频文件将从存储中删除；封面若未被其他内容引用会一并删除。
          </>
        }
        confirmLabel="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingVideo(null)}
      />

      {/* 孤儿封面清理（Phase 4 Step C3）：预览 + 确认删除 + 逐条结果 */}
      <CleanupDialog
        open={orphanOpen}
        title="清理孤儿封面"
        loading={orphanLoading}
        deleting={orphanDeleting}
        items={orphanItems.map((o) => ({
          id: o.id,
          url: o.url,
          title: o.storageKey || o.id,
          subtitle: `${formatSize(o.size)} · ${new Date(o.createdAt).toLocaleString('zh-CN')}`,
          badge: '未引用',
        }))}
        results={orphanResults}
        emptyText="没有孤儿封面。所有 VIDEO_POSTER 都被视频或文章引用。"
        deleteLabel={(n) => `删除 ${n} 个孤儿封面`}
        onClose={() => setOrphanOpen(false)}
        onDelete={() => void confirmOrphans()}
        onRescan={() => {
          setOrphanResults(null);
          void openOrphans();
        }}
      />
    </>
  );
}
