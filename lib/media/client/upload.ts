/**
 * 媒体上传领域（C12：manage-media / media-picker 共享上传执行）。
 *
 * - uploadMediaFile：单文件上传执行（API 调用 + 错误归一化），两处 UI 共用
 * - validateUploadTarget：上传目标校验（纯函数）
 * - 上传目标选项（纯配置）
 */
import { MediaType } from '@/lib/types/media';

/** 上传目标：文章图片 / 相册图片 */
export type UploadTarget = (typeof MediaType)[keyof typeof MediaType];

/** 上传目标选项（弹窗单选切换用） */
export const UPLOAD_TARGET_OPTIONS: { value: UploadTarget; label: string; hint: string }[] = [
  { value: MediaType.ARTICLE, label: '文章图片', hint: '用作文章配图' },
  { value: MediaType.GALLERY, label: '相册图片', hint: '加入相册' },
];

/** 上传目标校验（纯函数） */
export function validateUploadTarget(value: unknown): value is UploadTarget {
  return value === MediaType.ARTICLE || value === MediaType.GALLERY;
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
