/**
 * 视频枚举与领域类型（统一管理，禁止硬编码字符串）
 *
 * STATUS 三态：DRAFT（草稿）/ PUBLISHED（已发布）/ ARCHIVED（已下架）
 * VISIBILITY：PUBLIC（公开）/ PRIVATE（仅自己）
 * SOURCE：UPLOAD（本地上传）/ IMPORT（外部导入）/ SYNC（同步）——扩展点 7 预留
 */

export const VideoStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

export const VIDEO_STATUS_VALUES = Object.values(VideoStatus) as VideoStatus[];

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  [VideoStatus.DRAFT]: '草稿',
  [VideoStatus.PUBLISHED]: '已发布',
  [VideoStatus.ARCHIVED]: '已下架',
};

export const VideoVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;

export type VideoVisibility = (typeof VideoVisibility)[keyof typeof VideoVisibility];

export const VIDEO_VISIBILITY_VALUES = Object.values(VideoVisibility) as VideoVisibility[];

export const VideoSource = {
  UPLOAD: 'UPLOAD',
  IMPORT: 'IMPORT',
  SYNC: 'SYNC',
} as const;

export type VideoSource = (typeof VideoSource)[keyof typeof VideoSource];

export const VIDEO_SOURCE_VALUES = Object.values(VideoSource) as VideoSource[];

/** 支持的视频 MIME 类型（mp4 / webm） */
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

/** 默认单视频大小上限（200MB，可在后台 settings 覆盖） */
export const DEFAULT_MAX_VIDEO_SIZE = 200 * 1024 * 1024;
