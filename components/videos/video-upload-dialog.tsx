'use client';

/**
 * 视频上传弹窗（S3 Step B2）
 *
 * 流程：选文件 → 客户端校验 → <video> 探测时长/宽高 → presign →
 *       S3 预签名 XHR PUT（带进度）/ LOCAL multipart 降级 → 回调落库 → 完成
 *
 * 失败约定（四类路径均：不调回调、不落库、toast 提示、允许重试）：
 * 1. presign 网络/4xx/5xx 失败
 * 2. 探测失败（损坏文件 / 浏览器不支持）
 * 3. XHR PUT 失败 / 中断 / 超时（S3 孤儿文件交 bucket 生命周期清理）
 * 4. 回调 POST 失败（视频已上传到存储但未落库）
 *
 * 状态区分（上传中 / 处理中）：
 * - uploading：XHR 传输中，进度 0-100%
 * - processing：传输完成（进度 100%），服务端正在写库——不让人误以为卡死
 */
import { useRef, useState } from 'react';
import { Clapperboard, Loader2, UploadCloud, X } from 'lucide-react';
import { AdminModal } from '@/components/admin/modal';
import { useToast } from '@/components/ui/toast';
import { DEFAULT_MAX_VIDEO_SIZE } from '@/lib/types/video';
import {
  validateClientFile,
  parsePresignResponse,
  buildVideoCallbackBody,
  type PresignParsed,
} from '@/lib/videos/shared/video-probe';
import { captureVideoFrame } from './capture-frame';

/** 前端预检默认上限（MB）；presign 响应返回真实 maxSizeMb 后会复检 */
const DEFAULT_MAX_SIZE_MB = DEFAULT_MAX_VIDEO_SIZE / 1024 / 1024;

/** XHR 超时：与 presign 有效期上限一致（1h），慢网大文件不误杀 */
const UPLOAD_TIMEOUT_MS = 3600_000;

type UploadPhase = 'idle' | 'probing' | 'presigning' | 'uploading' | 'processing' | 'done';

type VideoMeta = {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
};

/** 探测视频时长/宽高（DOM 部分，组件内实现；失败返回 null） */
function probeVideoMeta(file: File): Promise<VideoMeta | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };
    const fail = () => {
      cleanup();
      resolve(null);
    };

    video.onloadedmetadata = () => {
      const meta: VideoMeta = {
        durationSeconds: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      };
      cleanup();
      resolve(meta);
    };
    video.onerror = fail;
    // 兜底：部分环境 metadata 事件不触发（15s 超时算探测失败）
    window.setTimeout(fail, 15_000);
    video.src = objectUrl;
  });
}

/** 自动截帧并上传为封面（VIDEO_POSTER，走现有图片链路）；失败静默降级返回 null */
async function uploadPosterFrame(file: File): Promise<string | null> {
  try {
    const frame = await captureVideoFrame(file);
    if (!frame) return null;
    const formData = new FormData();
    formData.append('file', new File([frame.blob], 'poster.jpg', { type: 'image/jpeg' }));
    formData.append('type', 'VIDEO_POSTER');
    const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
    if (!res.ok) return null;
    const media = (await res.json().catch(() => null)) as { id?: string } | null;
    return media?.id ?? null;
  } catch {
    return null;
  }
}

export function VideoUploadDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { showToast } = useToast();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const busy = phase === 'probing' || phase === 'presigning' || phase === 'uploading';

  const reset = () => {
    xhrRef.current = null;
    setPhase('idle');
    setProgress(0);
    setError(null);
    setSelectedFile(null);
  };

  const close = () => {
    // 上传中禁止关闭（XHR 不 abort，避免半途弃传）；处理中可关（回调自行完成）
    if (phase === 'uploading') {
      showToast('请等待上传完成或点击取消', 'error');
      return;
    }
    onClose();
    reset();
  };

  /** 取消上传：abort XHR → onabort 分支处理（不落库）；其余阶段直接重置 */
  const cancel = () => {
    if (phase === 'uploading') {
      xhrRef.current?.abort();
      setPhase('idle');
      setError('上传已取消');
      return;
    }
    onClose();
    reset();
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSelectedFile(file);
    // 第一步校验：mime / 空文件 / 默认上限
    const check = validateClientFile(file, DEFAULT_MAX_SIZE_MB);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    void runUpload(file);
  };

  /** 主流程（probe → 自动截帧封面 → presign → 分支上传），每步失败独立处理、不落库 */
  const runUpload = async (file: File) => {
    // ---- 探测（失败：不落库） ----
    setPhase('probing');
    const meta = await probeVideoMeta(file);
    if (!meta) {
      setPhase('idle');
      setError('无法读取视频信息，文件可能已损坏或浏览器不支持该编码');
      return;
    }

    // ---- 自动截帧封面（失败静默降级为无封面，不阻塞视频上传） ----
    const posterMediaId = await uploadPosterFrame(file);

    // ---- presign（网络/4xx/5xx 失败：不落库） ----
    setPhase('presigning');
    let parsed: PresignParsed;
    try {
      const presignRes = await fetch('/api/admin/videos/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!presignRes.ok) {
        const data = (await presignRes.json().catch(() => null)) as { error?: string } | null;
        setPhase('idle');
        setError(data?.error || '预签名失败，请重试');
        return;
      }
      parsed = parsePresignResponse(await presignRes.json());
    } catch {
      setPhase('idle');
      setError('网络异常，预签名失败');
      return;
    }

    if (!parsed.ok) {
      setPhase('idle');
      setError('预签名响应异常，请重试');
      return;
    }
    if (parsed.mode === 'rejected') {
      setPhase('idle');
      setError(
        `当前存储驱动（${parsed.driver || '未知'}）不适合视频，请先在「存储设置」中将「视频相册」绑定到 S3 档案`,
      );
      return;
    }
    if (parsed.mode === 'multipart') {
      await uploadMultipart(file, meta, posterMediaId);
      return;
    }

    // ---- S3 预签名直传 ----
    // presign 返回真实 maxSizeMb 后复检（大小上限以服务端配置为准）
    const recheck = validateClientFile(file, parsed.maxSizeMb);
    if (!recheck.ok) {
      setPhase('idle');
      setError(recheck.error);
      return;
    }
    await uploadPresigned(file, meta, parsed, posterMediaId);
  };

  /** LOCAL multipart 降级：XHR 带进度，失败不落库 */
  const uploadMultipart = (file: File, meta: VideoMeta, posterMediaId: string | null) =>
    new Promise<void>((resolve) => {
      setPhase('uploading');
      setProgress(0);

      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name.replace(/\.[^.]+$/, ''));
      if (posterMediaId) form.append('posterMediaId', posterMediaId);
      if (meta.durationSeconds != null)
        form.append('durationSeconds', String(meta.durationSeconds));
      if (meta.width != null) form.append('width', String(meta.width));
      if (meta.height != null) form.append('height', String(meta.height));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('POST', '/api/admin/videos');
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setPhase('done');
          showToast('上传成功', 'success');
          onUploaded();
          onClose();
          reset();
        } else {
          let msg = '上传失败，请重试';
          try {
            const d = JSON.parse(xhr.responseText) as { error?: string };
            if (d?.error) msg = d.error;
          } catch {
            /* 非 JSON 错误体，用默认文案 */
          }
          setPhase('idle');
          setError(msg);
        }
        resolve();
      };
      xhr.onerror = () => {
        setPhase('idle');
        setError('网络异常，上传失败');
        resolve();
      };
      xhr.onabort = () => {
        setPhase('idle');
        setError('上传已取消');
        resolve();
      };
      xhr.ontimeout = () => {
        setPhase('idle');
        setError('上传超时，请重试');
        resolve();
      };
      xhr.send(form);
    });

  /** S3 预签名直传：Content-Type 从 presign 响应取；PUT 成功后回调落库（processing 状态） */
  const uploadPresigned = (
    file: File,
    meta: VideoMeta,
    parsed: Extract<PresignParsed, { mode: 'presigned' }>,
    posterMediaId: string | null,
  ) =>
    new Promise<void>((resolve) => {
      setPhase('uploading');
      setProgress(0);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('PUT', parsed.presignedUrl);
      // 与 presign 请求的 Content-Type 保持一致（签名校验，不硬编码）
      xhr.setRequestHeader('Content-Type', parsed.contentType);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = async () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          setPhase('idle');
          setError(`上传失败（HTTP ${xhr.status}），请重试`);
          resolve();
          return;
        }
        // 传输完成 → 回调落库（处理中状态，防误以为卡死）
        setPhase('processing');
        try {
          const cbRes = await fetch('/api/admin/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              buildVideoCallbackBody({
                key: parsed.key,
                url: parsed.url || null,
                mimeType: file.type,
                size: file.size,
                durationSeconds: meta.durationSeconds,
                width: meta.width,
                height: meta.height,
                title: file.name.replace(/\.[^.]+$/, ''),
                posterMediaId,
              }),
            ),
          });
          if (!cbRes.ok) {
            const d = (await cbRes.json().catch(() => null)) as { error?: string } | null;
            setPhase('idle');
            setError(d?.error || '视频已上传到存储，但保存记录失败，请重试');
            // 不落库：无 DB 记录；S3 孤儿文件交 bucket 生命周期清理（见部署文档约定）
          } else {
            setPhase('done');
            showToast('上传成功', 'success');
            onUploaded();
            onClose();
            reset();
          }
        } catch {
          setPhase('idle');
          setError('网络异常，保存记录失败');
        }
        resolve();
      };
      xhr.onerror = () => {
        setPhase('idle');
        setError('网络异常，上传失败');
        resolve();
      };
      xhr.onabort = () => {
        setPhase('idle');
        setError('上传已取消');
        resolve();
      };
      xhr.ontimeout = () => {
        setPhase('idle');
        setError('上传超时，请重试');
        resolve();
      };
      xhr.send(file);
    });

  return (
    <AdminModal open={open} title="上传视频" onClose={close} closeDisabled={busy} maxWidth="md">
      <div className="space-y-4">
        {/* 文件选择 */}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {selectedFile ? selectedFile.name : '点击选择视频文件'}
          </span>
          <span className="text-xs text-muted-foreground">
            {selectedFile
              ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB · 上传后默认为草稿`
              : '支持 mp4 / webm，单文件默认不超过 200MB（可在后台设置调整）'}
          </span>
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>

        {/* 状态区 */}
        {phase === 'probing' || phase === 'presigning' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{phase === 'probing' ? '正在读取视频信息…' : '正在准备上传…'}</span>
          </div>
        ) : null}

        {phase === 'uploading' ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>上传中…</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {phase === 'processing' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>上传完成，正在保存记录…</span>
          </div>
        ) : null}

        {phase === 'done' ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Clapperboard className="h-4 w-4" />
            <span>上传成功</span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* 操作 */}
        <div className="flex justify-end gap-2">
          {busy ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
              取消上传
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                reset();
              }}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
