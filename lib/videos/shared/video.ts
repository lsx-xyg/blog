/**
 * 视频领域纯函数（无 IO，可单测）
 *
 * - 宽高比：瀑布流卡片按视频原始宽高比撑开，缺失时按 fallback 回退（9:16 竖屏 / 16:9 横屏）
 * - 时长格式化：mm:ss 展示
 * - MIME / 状态 / 可见性校验：API 入参收口
 */
import {
  ALLOWED_VIDEO_MIME_TYPES,
  VIDEO_STATUS_VALUES,
  VIDEO_VISIBILITY_VALUES,
} from '@/lib/types/video';

/** 宽高缺失时的回退方向 */
export type AspectFallback = 'portrait' | 'landscape';

/**
 * 生成 CSS aspect-ratio 值（瀑布流卡片用）
 *
 * - 宽高齐全 → "width/height"（原始比例，形成错落）
 * - 缺失 → fallback：portrait → "9/16"，landscape → "16/9"
 */
export function getAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
  fallback: AspectFallback = 'landscape',
): string {
  if (width && height && width > 0 && height > 0) {
    return `${width}/${height}`;
  }
  return fallback === 'portrait' ? '9/16' : '16/9';
}

/** 视频 MIME 是否受支持（mp4/webm） */
export function isValidVideoMimeType(mime: string | null | undefined): boolean {
  return !!mime && (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mime);
}

/** 视频状态枚举校验 */
export function isValidVideoStatus(value: unknown): value is (typeof VIDEO_STATUS_VALUES)[number] {
  return typeof value === 'string' && (VIDEO_STATUS_VALUES as readonly string[]).includes(value);
}

/** 视频可见性枚举校验 */
export function isValidVideoVisibility(
  value: unknown,
): value is (typeof VIDEO_VISIBILITY_VALUES)[number] {
  return (
    typeof value === 'string' && (VIDEO_VISIBILITY_VALUES as readonly string[]).includes(value)
  );
}

/** 默认标题：文件名去扩展名 */
export function defaultVideoTitle(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base.trim() || '未命名视频';
}

/** 时长格式化（秒 → mm:ss；超过 1 小时 → h:mm:ss） */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds < 0 || !Number.isFinite(totalSeconds)) return '00:00';
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
