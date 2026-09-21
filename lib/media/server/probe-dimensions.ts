/**
 * 图片尺寸探测（服务端）
 *
 * 用途：上传时把图片原始宽高写进 media 表的 width / height 列，
 * 前端 next/image 才能用 intrinsic 模式渲染（保持原始宽高比、无布局抖动）。
 * 相册瀑布流尤其依赖这个：CSS columns 布局无法用 fill 模式（要求父容器有确定高度）。
 *
 * 依赖 sharp（Next.js 图片优化本来就需要它，已在 dependencies 中显式声明）。
 * 探测失败不抛错，返回 null —— 上传流程不能被尺寸探测阻断，
 * 前端对 null 有兜底占位比例。
 */
import sharp from 'sharp';

export type ImageDimensions = { width: number; height: number };

/** 读取图片原始宽高；失败返回 null */
export async function probeImageDimensions(buffer: Buffer): Promise<ImageDimensions | null> {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width && meta.height) {
      return { width: meta.width, height: meta.height };
    }
    return null;
  } catch (error) {
    console.warn('[media] 图片尺寸探测失败：', error);
    return null;
  }
}
