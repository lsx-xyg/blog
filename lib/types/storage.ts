/** 存储驱动抽象层（StorageDriver interface）
 *
 * 三个实现：
 * - local：本地文件存储（开发环境用，存在 public/uploads/）
 * - github：GitHub 图床（生产环境用，jsDelivr CDN 加速）
 * - s3：S3 兼容存储（占位，后续实现）
 *
 * 切换方式：环境变量 STORAGE_DRIVER=local|github|s3
 */
/** 上传结果 */
export interface UploadResult {
  /** 访问 URL（本地驱动返回 /uploads/...，GitHub 驱动返回 jsDelivr CDN URL） */
  url: string;
  /** 存储键（相对路径，如 2026/09/uuid.jpg），用于删除 */
  key: string;
  /** 文件大小（字节） */
  size: number;
  /** MIME 类型 */
  mimeType: string;
}
/** 存储驱动接口 */

export interface StorageDriverInterface {
  /** 上传文件 */
  upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
  /** 删除文件（按 key） */
  delete(key: string): Promise<void>;
  /** 根据 key 获取访问 URL */
  getUrl(key: string): string;
  /**
   * 下载文件内容（按 key）
   *
   * 对于公开仓库/公开 bucket，可以直接 fetch(getUrl())
   * 对于私有仓库/私有 bucket，需要使用 API+Token 或预签名 URL 下载
   * GitHub 驱动重写此方法，使用 Contents API + Token 下载私有仓库文件
   */
  download(key: string): Promise<Buffer>;
  /** 驱动名称 */
  name: string;
}
/** 支持的图片 MIME 类型 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
/** 单张图片最大大小（10MB） */

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
/** 存储驱动类型（用于 storage.driver 的 default/transform 类型对齐） */

export const StorageDriverType = {
  LOCAL: 'LOCAL',
  GITHUB: 'GITHUB',
  S3: 'S3',
} as const;

export type StorageDriverType =
  (typeof StorageDriverType)[keyof typeof StorageDriverType]; /** 存储驱动枚举 */

export const STORAGE_DRIVER_VALUES = Object.values(StorageDriverType) as StorageDriverType[];

/** GitHub 访问 URL 拼接方式 */
export const GithubUrlStyle = {
  /** 普通路径格式：{cdnBase}/{owner}/{repo}/{branch}/{path}（raw 直连、各类代理均为此格式） */
  PATH: 'path',
  /** jsDelivr 特有格式：{cdnBase}/{owner}/{repo}@{branch}/{path} */
  AT: 'at',
} as const;

export type GithubUrlStyle = (typeof GithubUrlStyle)[keyof typeof GithubUrlStyle];

export const GITHUB_URL_STYLE_VALUES = Object.values(GithubUrlStyle) as GithubUrlStyle[];
