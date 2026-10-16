/**
 * 媒体上传领域（C12：manage-media / media-picker 共享上传执行）。
 *
 * - uploadMediaFile：单文件上传执行（API 调用 + 错误归一化），两处 UI 共用
 * - validateUploadTarget：上传目标校验（纯函数）
 * - 上传目标选项（纯配置）
 */
import { MediaType } from '@/lib/types/media';

/** 上传目标：文章图片 / 相册图片 / 视频封面（内部用途） */
export type UploadTarget = (typeof MediaType)[keyof typeof MediaType];

/** 上传目标选项（弹窗单选切换用）——视频封面是内部用途，不在此暴露 */
export const UPLOAD_TARGET_OPTIONS: { value: UploadTarget; label: string; hint: string }[] = [
  { value: MediaType.ARTICLE, label: '文章图片', hint: '用作文章配图' },
  { value: MediaType.GALLERY, label: '相册图片', hint: '加入相册' },
];

/**
 * 上传目标校验（纯函数）
 * VIDEO_POSTER 仅由视频编辑弹窗的封面上传调用方使用（文章/相册上传不受影响）。
 */
export function validateUploadTarget(value: unknown): value is UploadTarget {
  return (
    value === MediaType.ARTICLE || value === MediaType.GALLERY || value === MediaType.VIDEO_POSTER
  );
}

export type UploadMediaResult = { ok: true; url: string } | { ok: false; error: string };

/** 单文件上传：走媒体库 API（自动保存到 media 表），错误归一化返回 */
export async function uploadMediaFile(file: File, type: UploadTarget): Promise<UploadMediaResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/admin/media', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.error || `上传失败（${res.status}）` };
    }

    const data = await res.json();
    return { ok: true, url: data.url as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '上传失败，请重试' };
  }
}

export type UploadProgress = (percent: number) => void;

/**
 * 带进度的单文件上传（XHR + FormData）。
 *
 * 任务列表并发上传用：`onProgress(0-100)` 报告上传进度（不含服务端处理阶段）；
 * 失败路径与 uploadMediaFile 一致（错误归一化，不抛异常）。
 */
export function uploadMediaFileXhr(
  file: File,
  type: UploadTarget,
  onProgress?: UploadProgress,
): Promise<UploadMediaResult> {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    xhr.timeout = 120_000;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url?: string };
          if (data.url) {
            onProgress?.(100);
            resolve({ ok: true, url: data.url });
            return;
          }
          resolve({ ok: false, error: '响应缺少图片地址' });
        } catch {
          resolve({ ok: false, error: '响应解析失败' });
        }
      } else {
        let err = `上传失败（${xhr.status}）`;
        try {
          const d = JSON.parse(xhr.responseText) as { error?: string };
          if (d?.error) err = d.error;
        } catch {
          /* 保持默认错误文案 */
        }
        resolve({ ok: false, error: err });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: '网络异常，上传失败' });
    xhr.ontimeout = () => resolve({ ok: false, error: '上传超时，请重试' });
    xhr.send(formData);
  });
}

/** 并发执行器：限制并发数，worker 逐项执行（异常由 worker 内部消化，不中断批次） */
export async function runConcurrent<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      await worker(items[current], current);
    }
  });
  await Promise.all(workers);
}

/** 批量上传：逐个执行，汇总成功/失败（供 toast 文案与错误提示） */
export async function uploadMediaFiles(
  files: File[],
  type: UploadTarget,
): Promise<{ success: number; failed: number; firstError?: string }> {
  let success = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const file of files) {
    const r = await uploadMediaFile(file, type);
    if (r.ok) success++;
    else {
      failed++;
      firstError ??= r.error;
    }
  }
  return { success, failed, firstError };
}
