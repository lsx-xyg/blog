/**
 * 孤儿视频封面 · 纯函数（无 IO，可单测）
 *
 * 孤儿定义（用户确认）：
 * - 所有 VIDEO_POSTER 类型的 media
 * - 减去被任何 videos.posterMediaId 引用的（不查视频状态，DRAFT/PUBLISHED 都算引用）
 * - 三种孤儿来源：视频被删 / 用户移除封面 / 上传封面后取消编辑
 */

/** 孤儿候选（纯函数输入的最小结构） */
export type PosterCandidate = {
  id: string;
  url: string;
};

/**
 * 纯函数：从候选封面里筛出孤儿
 *
 * - referencedPosterIds：所有 videos.posterMediaId 非空值的集合
 * - referencedUrls：被文章内容引用的 url 集合（isMediaReferenced 结果）
 * - 两个维度任一命中 → 不是孤儿
 */
export function filterOrphanPosters(
  candidates: PosterCandidate[],
  referencedPosterIds: Set<string>,
  referencedUrls: Set<string>,
): PosterCandidate[] {
  return candidates.filter((c) => !referencedPosterIds.has(c.id) && !referencedUrls.has(c.url));
}
