/**
 * 媒体类型枚举（统一管理，禁止硬编码字符串）
 *
 * ARTICLE: 文章图片（从文章编辑器上传）
 * GALLERY: 相册图片（从相册管理页上传）
 * VIDEO_POSTER: 视频封面（服务 videos.posterMediaId；图片 Tab / media-picker 一律排除，
 *               删除由视频删除流程联动处理，findUnusedMedia 排除仅是兜底，不承担回收职责）
 */
export const MediaType = {
  ARTICLE: 'ARTICLE',
  GALLERY: 'GALLERY',
  VIDEO_POSTER: 'VIDEO_POSTER',
} as const;

export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const MEDIA_TYPE_VALUES = Object.values(MediaType) as MediaType[];

/** 媒体类型显示名称 */
export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  [MediaType.ARTICLE]: '文章图片',
  [MediaType.GALLERY]: '相册图片',
  [MediaType.VIDEO_POSTER]: '视频封面',
};
