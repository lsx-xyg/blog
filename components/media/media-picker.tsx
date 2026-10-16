'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  X,
  Upload,
  Search,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { MediaType, MEDIA_TYPE_LABELS } from '@/lib/types/media';
import { uploadMediaFileXhr, runConcurrent } from '@/lib/media/client';

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
  /** 批量选择（多文件上传成功后一次性插入）——编辑器可实现批量插入，未提供时退化为单选 */
  onSelectMany?: (items: { url: string; alt?: string }[]) => void;
  defaultType?: MediaType | 'ALL';
};

type UploadTask = {
  id: number;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
};

/** 并发上传任务数（避免一次性打爆服务端/连接数） */
const UPLOAD_CONCURRENCY = 3;

/**
 * 媒体库选择器组件
 *
 * - Tab 切换：上传新图片 / 从图库选择
 * - 上传：多文件并发（任务列表显示每个文件进度/状态），成功后批量回调 onSelectMany
 * - 图库：无限滚动分页（IntersectionObserver 触底加载），支持类型筛选与搜索
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  onSelectMany,
  defaultType = 'ALL',
}: MediaPickerProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('library');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaType | 'ALL'>(defaultType);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(24);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 加载媒体库（append=true 追加下一页；否则重置为第一页）
  const loadItems = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(append ? page : 1));
        params.set('pageSize', String(pageSize));
        if (typeFilter !== 'ALL') params.set('type', typeFilter);
        if (search) params.set('search', search);

        const res = await fetch(`/api/admin/media?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const newItems = (data.items || []) as MediaItem[];
          setItems((prev) => {
            const merged = append ? [...prev, ...newItems] : newItems;
            setHasMore(merged.length < (data.total || 0));
            return merged;
          });
          setTotal(data.total || 0);
        } else {
          if (!append) setHasMore(false);
        }
      } catch (e) {
        console.error('加载媒体库失败：', e);
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [page, pageSize, typeFilter, search],
  );

  // 打开 / 切换 Tab / 筛选 / 搜索变化 → 重置到第一页加载
  useEffect(() => {
    if (open && activeTab === 'library') {
      setPage(1);
      loadItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, typeFilter, search]);

  // 触底翻页（page > 1）→ 追加加载
  useEffect(() => {
    if (open && activeTab === 'library' && page > 1) {
      loadItems(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 触底自动加载下一页
  useEffect(() => {
    if (!open || activeTab !== 'library') return;
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
          setPage((p) => p + 1);
        }
      },
      { root, rootMargin: '200px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open, activeTab, loading, loadingMore, hasMore]);

  // 处理文件上传（并发任务列表；全部完成后批量回调）
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const base = Date.now();
    const newTasks: UploadTask[] = Array.from(files).map((file, i) => ({
      id: base + i,
      file,
      status: 'pending',
      progress: 0,
    }));
    setTasks(newTasks);
    setUploading(true);

    const updateTask = (id: number, patch: Partial<UploadTask>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    };

    const succeeded: { url: string; alt?: string }[] = [];
    await runConcurrent(newTasks, UPLOAD_CONCURRENCY, async (task) => {
      updateTask(task.id, { status: 'uploading' });
      const r = await uploadMediaFileXhr(task.file, MediaType.ARTICLE, (p) =>
        updateTask(task.id, { progress: p }),
      );
      if (r.ok) {
        updateTask(task.id, { status: 'success', progress: 100 });
        succeeded.push({ url: r.url, alt: task.file.name });
      } else {
        updateTask(task.id, { status: 'error', error: r.error });
      }
    });

    setUploading(false);
    if (succeeded.length > 0) {
      if (onSelectMany) onSelectMany(succeeded);
      else onSelect(succeeded[0].url, succeeded[0].alt);
      onClose();
    }
  };

  // 选择图片
  const handleSelect = (item: MediaItem) => {
    onSelect(item.url, item.title || undefined);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">插入图片</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'library'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            从图库选择
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            上传新图片
          </button>
        </div>

        {/* 内容区（滚动容器） */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {activeTab === 'upload' ? (
            /* 上传新图片 */
            <div className="flex flex-col items-center justify-center py-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFileUpload(e.target.files);
                  e.target.value = '';
                }}
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
                  {uploading ? '上传中…' : '点击选择图片或拖拽到此处'}
                </span>
                <span className="text-xs text-muted-foreground">
                  支持多选，自动并发上传（最多 {UPLOAD_CONCURRENCY} 个同时）
                </span>
              </button>
              <p className="mt-3 text-xs text-muted-foreground">
                从文章编辑器上传的图片会自动标记为「{MEDIA_TYPE_LABELS[MediaType.ARTICLE]}」
              </p>

              {/* 上传任务列表 */}
              {tasks.length > 0 && (
                <div className="mt-5 w-full max-w-lg space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm">{t.file.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t.status === 'uploading'
                              ? `${t.progress}%`
                              : t.status === 'success'
                                ? '成功'
                                : t.status === 'error'
                                  ? '失败'
                                  : '等待中'}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              t.status === 'error'
                                ? 'bg-destructive'
                                : t.status === 'success'
                                  ? 'bg-emerald-500'
                                  : 'bg-primary'
                            }`}
                            style={{ width: `${t.progress}%` }}
                          />
                        </div>
                        {t.error && (
                          <p className="mt-1 truncate text-xs text-destructive">{t.error}</p>
                        )}
                      </div>
                      {t.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : t.status === 'error' ? (
                        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <Loader2
                          className={`h-4 w-4 shrink-0 animate-spin text-muted-foreground ${
                            t.status === 'pending' ? 'opacity-40' : ''
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* 从图库选择 */
            <div className="space-y-4">
              {/* 筛选和搜索 */}
              <div className="flex flex-wrap items-center gap-3">
                {/* 类型筛选 */}
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('ALL');
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      typeFilter === 'ALL'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter(MediaType.ARTICLE);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      typeFilter === MediaType.ARTICLE
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {MEDIA_TYPE_LABELS[MediaType.ARTICLE]}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter(MediaType.GALLERY);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      typeFilter === MediaType.GALLERY
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {MEDIA_TYPE_LABELS[MediaType.GALLERY]}
                  </button>
                </div>

                {/* 搜索 */}
                <div className="relative min-w-[150px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
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
                        type="button"
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
                      >
                        <Image
                          src={item.url}
                          alt={item.title || '媒体图片'}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* 类型标签 */}
                        <div className="absolute left-1 top-1">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              item.type === MediaType.ARTICLE
                                ? 'bg-blue-500/90 text-white'
                                : 'bg-purple-500/90 text-white'
                            }`}
                          >
                            {item.type === MediaType.ARTICLE ? '文' : '相'}
                          </span>
                        </div>
                        {/* 悬浮遮罩 */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-sm font-medium text-white">点击选择</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* 触底加载 sentinel */}
                  <div ref={sentinelRef} className="flex items-center justify-center py-4">
                    {loadingMore ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : hasMore ? (
                      <span className="text-xs text-muted-foreground">下拉加载更多…</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        已加载全部 {total} 张图片
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
