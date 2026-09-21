/**
 * 存储通道（用途）注册表 —— 扩展点文件
 *
 * 「通道」是存储的用途维度：文章图片、相册图片、数据库备份……
 * 每个通道在后台绑定一个存储档案（storage_profiles 表），上传时按通道路由。
 *
 * ★ 以后加新用途只改这个文件：往 StorageChannel 加一行，
 *   并在 STORAGE_CHANNEL_META 里补一条元数据即可，
 *   factory / API / UI 全部自动跟随，无需改其他代码。
 */
import { MediaType } from '@/lib/types/media';

/** 存储用途（通道）枚举 */
export const StorageChannel = {
  /** 文章/后台图片上传 */
  UPLOAD: 'upload',
  /** 相册图片 */
  GALLERY: 'gallery',
  /** 数据库备份等私有数据 */
  BACKUP: 'backup',
  // FILE: 'file', // 示例：以后加「附件/文件下载」用途，加一行即可
} as const;

export type StorageChannel = (typeof StorageChannel)[keyof typeof StorageChannel];

export const STORAGE_CHANNEL_VALUES = Object.values(StorageChannel) as StorageChannel[];

/** 通道可见性：public = 承载公开访问资源（必须有公网 URL），private = 仅服务端存取 */
export type StorageVisibility = 'public' | 'private';

/** 通道元数据 */
export type StorageChannelMeta = {
  /** 后台显示名 */
  label: string;
  /** 说明文案 */
  description: string;
  /** 可见性（决定可选档案的范围） */
  visibility: StorageVisibility;
  /** 通道对应的媒体类型（public 通道用于按 media.type 自动路由，private 通道为 null） */
  mediaType: MediaType | null;
  /** 绑定配置的 settings key */
  settingKey: string;
  /** 绑定配置的环境变量名（应急覆盖） */
  env: string;
};

export const STORAGE_CHANNEL_META: Record<StorageChannel, StorageChannelMeta> = {
  [StorageChannel.UPLOAD]: {
    label: '文章图片',
    description: '文章编辑器与后台上传的插图',
    visibility: 'public',
    mediaType: MediaType.ARTICLE,
    settingKey: 'storage.binding.upload',
    env: 'STORAGE_BINDING_UPLOAD',
  },
  [StorageChannel.GALLERY]: {
    label: '相册图片',
    description: '相册页展示的照片（适合放 R2 等大容量对象存储）',
    visibility: 'public',
    mediaType: MediaType.GALLERY,
    settingKey: 'storage.binding.gallery',
    env: 'STORAGE_BINDING_GALLERY',
  },
  [StorageChannel.BACKUP]: {
    label: '数据库备份',
    description: '定时/手动备份文件（私有数据，不需要公网访问）',
    visibility: 'private',
    mediaType: null,
    settingKey: 'storage.binding.backup',
    env: 'STORAGE_BINDING_BACKUP',
  },
};

/** 驱动元数据（UI 与校验用） */
export const STORAGE_DRIVER_META: Record<
  string,
  { label: string; visibility: StorageVisibility[]; description: string }
> = {
  LOCAL: {
    label: '本地磁盘',
    visibility: ['public', 'private'],
    description: '存到服务器本地目录（Vercel 上无持久化文件系统，仅开发/自托管可用）',
  },
  GITHUB: {
    label: 'GitHub 仓库',
    visibility: ['public', 'private'],
    description: 'GitHub 公开/私有仓库 + CDN/反代加速',
  },
  S3: {
    label: 'S3 兼容对象存储',
    visibility: ['public', 'private'],
    description: 'Cloudflare R2 / 阿里云 OSS / MinIO 等（填对应 endpoint 即可）',
  },
  WEBDAV: {
    label: 'WebDAV',
    visibility: ['private'],
    description: '坚果云 / NAS / Alist 等（无公网直链，仅限私有用途如备份）',
  },
};
