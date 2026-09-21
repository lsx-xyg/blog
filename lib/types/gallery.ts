/**
 * 相册相关类型定义。
 *
 * 单独成文件的原因：
 * - 被数据访问层、组件、API route 多处引用
 * - 避免类型层与实现层形成循环依赖
 */
import { StorageDriverType } from '@/lib/types/storage';

/** 相册项（即 media 表中 type=GALLERY 的记录） */
export type GalleryItemWithMedia = {
  id: string;
  title: string | null;
  description: string | null;
  featured: boolean;
  createdAt: Date;
  // media 表字段
  imageUrl: string;
  storageDriver: StorageDriverType;
  storageKey: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
};

/** search-index 元数据类型（T7 方案 A：全量轻量数据下发，前端筛选/搜索） */
export type GalleryMeta = {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  /** 原始宽高（上传时用 sharp 探测，老数据可能为 null → 前端用默认比例兜底） */
  width: number | null;
  height: number | null;
  featured: boolean;
  createdAt: Date;
  tags: string[];
};
