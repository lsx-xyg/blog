'use client';

/**
 * 视频编辑弹窗（S3 Step B1）
 *
 * 字段：标题 / 描述 / 封面（上传=VIDEO_POSTER / 移除）/ 拍摄时间 / 地点 / 标签 / 排序 /
 * 可见性 / 发布状态。
 *
 * 封面约定：
 * - 替换封面：新封面入库（POST /api/admin/media, type=VIDEO_POSTER）→ 更新 posterMediaId，
 *   旧封面不立即删除（交给「未使用图片清理」统一处理）
 * - 清除封面：posterMediaId 置 null，旧封面不删除（同上）
 * - 取消编辑产生的孤儿封面：VIDEO_POSTER 不参与未使用清理，Phase 4 提供「孤儿封面清理」入口
 *   （见 docs/adr/0019-video-poster-orphan-behavior.md）
 *
 * 时区约定：表单 datetime-local 输入 → localDatetimeToUtcIso 转 UTC ISO 提交；
 * 回显 utcIsoToLocalDatetime 转本地。三层（前端提交/后端存储/前端回显）均为 UTC 单一来源。
 */
import { useEffect, useState } from 'react';
import { ImagePlus, ImageOff, Loader2, Video } from 'lucide-react';
import { AdminModal } from '@/components/admin/modal';
import { TagInput } from '@/components/shared/tag-input';
import { useToast } from '@/components/ui/toast';
import { MediaType } from '@/lib/types/media';
import { VideoStatus, VideoVisibility, VIDEO_STATUS_LABELS } from '@/lib/types/video';
import { localDatetimeToUtcIso, utcIsoToLocalDatetime } from '@/lib/videos/shared/datetime';
import { captureVideoFrame } from './capture-frame';
import Image from 'next/image';

export type EditVideoPayload = {
  id: string;
  title: string | null;
  description: string | null;
  posterMediaId: string | null;
  posterUrl: string;
  /** 视频播放/回源地址（生成封面用） */
  url: string;
  takenAt: string | null;
  location: string | null;
  tags: string[];
  sortOrder: number;
  visibility: VideoVisibility;
  status: VideoStatus;
};

export function VideoEditDialog({
  open,
  video,
  onClose,
  onSaved,
}: {
  open: boolean;
  video: EditVideoPayload | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [takenAtLocal, setTakenAtLocal] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState(0);
  const [visibility, setVisibility] = useState<VideoVisibility>(VideoVisibility.PUBLIC);
  const [status, setStatus] = useState<VideoStatus>(VideoStatus.DRAFT);
  const [posterMediaId, setPosterMediaId] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState('');
  const [allTags, setAllTags] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [posterUploading, setPosterUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 打开时回填表单
  useEffect(() => {
    if (!open || !video) return;
    setTitle(video.title ?? '');
    setDescription(video.description ?? '');
    setTakenAtLocal(utcIsoToLocalDatetime(video.takenAt));
    setLocation(video.location ?? '');
    setTags(video.tags ?? []);
    setSortOrder(video.sortOrder ?? 0);
    setVisibility(video.visibility ?? VideoVisibility.PUBLIC);
    setStatus(video.status ?? VideoStatus.DRAFT);
    setPosterMediaId(video.posterMediaId);
    setPosterUrl(video.posterUrl ?? '');
    setSaving(false);
    setPosterUploading(false);

    // 加载已有标签（下拉提示）
    fetch('/api/admin/tags')
      .then((res) => res.json())
      .then((data) => setAllTags(data.tags || []))
      .catch(() => {});
  }, [open, video]);

  // 上传封面（VIDEO_POSTER：只服务 videos.posterMediaId，不参与图片 Tab / media-picker）
  const handlePosterUpload = async (file: File | undefined) => {
    if (!file) return;
    setPosterUploading(true);
    try {
      // 直接调上传 API 拿完整响应（含 media.id），存 posterMediaId；
      // 不用 uploadMediaFile（其返回仅 url，无 id）
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', MediaType.VIDEO_POSTER);
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast(data?.error || '封面上传失败', 'error');
        return;
      }
      const media = await res.json();
      setPosterMediaId(media.id);
      setPosterUrl(media.url);
      showToast('封面已上传', 'success');
    } catch (e) {
      console.error('封面上传失败：', e);
      showToast('封面上传失败，请重试', 'error');
    } finally {
      setPosterUploading(false);
    }
  };

  /** 从视频源截取首帧生成封面（未设置封面时的兜底）；复用 handlePosterUpload 入库 */
  const handleGeneratePoster = async () => {
    if (!video?.url) {
      showToast('当前视频暂无播放地址，无法生成封面', 'error');
      return;
    }
    const frame = await captureVideoFrame(video.url);
    if (!frame) {
      showToast('生成封面失败：无法读取视频画面（编码不支持或网络失败）', 'error');
      return;
    }
    await handlePosterUpload(new File([frame.blob], 'poster.jpg', { type: 'image/jpeg' }));
  };

  const save = async () => {
    if (!video) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          posterMediaId,
          takenAt: localDatetimeToUtcIso(takenAtLocal),
          location: location || null,
          tags,
          sortOrder,
          visibility,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast(data?.error || '保存失败', 'error');
        return;
      }
      showToast('保存成功', 'success');
      onSaved();
      onClose();
    } catch (e) {
      console.error('保存视频失败：', e);
      showToast('保存失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title="编辑视频"
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : null}
            保存
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 封面 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">封面</label>
          <div className="flex items-center gap-3">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt="视频封面"
                width={160}
                height={90}
                className="h-20 w-36 rounded-lg border border-border object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground">
                <ImageOff className="h-5 w-5" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
                <ImagePlus className="h-3.5 w-3.5" />
                {posterUploading ? '上传中…' : '上传封面'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={posterUploading}
                  onChange={(e) => handlePosterUpload(e.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => void handleGeneratePoster()}
                disabled={posterUploading}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                title="不设置封面时，从视频第一帧生成"
              >
                <Video className="h-3.5 w-3.5" />
                从视频生成封面
              </button>
              {posterUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setPosterMediaId(null);
                    setPosterUrl('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <ImageOff className="h-3.5 w-3.5" />
                  移除封面
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            替换/移除封面不会立即删除旧封面，交由「未使用图片清理」统一处理。
          </p>
        </div>

        {/* 标题 */}
        <div>
          <label
            htmlFor="video-edit-title"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            标题
          </label>
          <input
            id="video-edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="未命名视频"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 描述 */}
        <div>
          <label
            htmlFor="video-edit-desc"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            描述
          </label>
          <textarea
            id="video-edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="这段视频想记录什么…"
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 拍摄时间 */}
          <div>
            <label
              htmlFor="video-edit-taken-at"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              拍摄时间
            </label>
            <input
              id="video-edit-taken-at"
              type="datetime-local"
              value={takenAtLocal}
              onChange={(e) => setTakenAtLocal(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 地点 */}
          <div>
            <label
              htmlFor="video-edit-location"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              地点
            </label>
            <input
              id="video-edit-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="如：青岛·栈桥"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* 标签 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">标签</label>
          <TagInput value={tags} onChange={setTags} allTags={allTags} id="video-edit-tags" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* 排序 */}
          <div>
            <label
              htmlFor="video-edit-sort"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              排序
            </label>
            <input
              id="video-edit-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 可见性 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">可见性</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as VideoVisibility)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value={VideoVisibility.PUBLIC}>公开</option>
              <option value={VideoVisibility.PRIVATE}>仅自己</option>
            </select>
          </div>

          {/* 发布状态 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">发布状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VideoStatus)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {(Object.keys(VIDEO_STATUS_LABELS) as VideoStatus[]).map((s) => (
                <option key={s} value={s}>
                  {VIDEO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
