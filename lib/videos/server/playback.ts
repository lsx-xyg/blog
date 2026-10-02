/**
 * 视频播放地址解析（仅在服务端调用，客户端永远拿到已签好的 URL）
 *
 * 策略（用户确认）：
 * - 公开 bucket：videos.url 非空 → 直接使用，不签名
 * - 私有 bucket：videos.url 为空 → 按 storageKey + storageDriver 每次 SSR 重签（24h）
 * - 签名函数只接受 storageKey + storageDriver，不接受前端传参（密钥不暴露）
 *
 * 扩展点 5（转码/HLS）：播放地址统一由此函数生成，不写死，后续可在此切换 CDN/转码地址
 */
import { getStorageDriverForPlatform } from '@/lib/storage/server/factory';
import { StorageDriverType } from '@/lib/types/storage';
import type { PublicVideoDetail } from './public';

/** 私有 bucket 预签名下载有效期：24h（个人博客足够） */
export const PRESIGNED_PLAYBACK_TTL_SECONDS = 86400;

const STORAGE_DRIVER_VALUES = Object.values(StorageDriverType) as string[];

/**
 * 解析播放 URL（服务端专用）
 *
 * - url 非空 → 原样返回（公开直链）
 * - url 为空 → 私有 bucket：按存储驱动重签；驱动缺失或非法返回 null（页面 404）
 */
export async function resolvePlaybackUrl(
  video: Pick<PublicVideoDetail, 'url' | 'storageKey' | 'storageDriver'>,
): Promise<string | null> {
  if (video.url) return video.url;

  const driverType = video.storageDriver ?? StorageDriverType.S3;
  // storageDriver 来自 DB（text 列），先校验再传给驱动工厂，防止类型越界
  if (!STORAGE_DRIVER_VALUES.includes(driverType)) return null;

  const driver = await getStorageDriverForPlatform(driverType as StorageDriverType, 'public');
  if (!driver || !video.storageKey) return null;

  return driver.getPresignedDownloadUrl(video.storageKey, PRESIGNED_PLAYBACK_TTL_SECONDS);
}
