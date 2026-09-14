/** search-index 元数据类型（T7 方案 A：全量轻量数据下发，前端筛选/搜索） */
export type PostMeta = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  featured: boolean;
  createdAt: Date;
  publishedAt: Date | null;
  tags: string[];
};

export const PostStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const POST_STATUS_VALUES = Object.values(PostStatus) as PostStatus[];
