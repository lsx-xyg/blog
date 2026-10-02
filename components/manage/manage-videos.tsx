'use client';

/**
 * 后台视频管理（S3 空壳：列表 + 分页 + 状态筛选）
 *
 * Step B 将补：上传弹窗（XHR 进度直传/降级）、编辑弹窗、发布/下架/删除。
 */
import { useCallback, useEffect, useState } from 'react';
import { Clapperboard, Plus } from 'lucide-react';
import { AdminListPage } from '@/components/admin/list-page';
import { CreateButton, RefreshButton } from '@/components/admin/action-buttons';
import { VideoStatus, VIDEO_STATUS_LABELS } from '@/lib/types/video';
import { formatDuration } from '@/lib/videos/shared/video';
import Image from 'next/image';

type VideoItem = {
  id: string;
  title: string | null;
  description: string | null;
  url: string | null;
  posterUrl: string;
  storageDriver: string;
  storageKey: string | null;
  mimeType: string | null;
  size: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  status: VideoStatus;
  visibility: string;
  location: string | null;
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

export function ManageVideos() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VideoStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(12);

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

  return (
    <AdminListPage
      title="视频"
      description="个人生活视频相册。支持 mp4 / webm，上传后默认为草稿，发布后才在前台展示。"
      actions={
        <>
          <CreateButton
            onClick={() => {}}
            label="上传视频"
            icon={Plus}
            disabled
            title="上传功能即将开放"
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
                search || statusFilter !== 'ALL' ? undefined : '点击右上角「上传视频」上传第一条吧',
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
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  创建时间
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
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatSize(v.size)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[v.status]}`}
                    >
                      {VIDEO_STATUS_LABELS[v.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString('zh-CN', { hour12: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 移动端：卡片列表（操作下沉模式，Step B 补操作按钮） */}
        <div className="md:hidden rounded-xl border border-border bg-card divide-y divide-border">
          {items.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-4 animate-fade-in-up">
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
  );
}
