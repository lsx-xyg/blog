/**
 * 媒体类型枚举（统一管理，禁止硬编码字符串）
 *
 * ARTICLE: 文章图片（从文章编辑器上传）
 * GALLERY: 相册图片（从相册管理页上传）
 */
export enum MediaType {
  ARTICLE = "ARTICLE",
  GALLERY = "GALLERY",
}

/** 媒体类型显示名称 */
export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  [MediaType.ARTICLE]: "文章图片",
  [MediaType.GALLERY]: "相册图片",
};

/** 存储驱动枚举 */
export enum StorageDriverType {
  LOCAL = "LOCAL",
  GITHUB = "GITHUB",
  S3 = "S3",
}
