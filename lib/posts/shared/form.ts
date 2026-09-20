/**
 * 文章编辑表单领域（C10：post-editor 表单状态机提炼）。
 *
 * 数据模型 / 默认值 / 步骤元数据 / payload 构造 / 校验全部纯函数化，
 * usePostForm hook 只做状态编排，组件只做 JSX。
 */
import { PostStatus } from '@/lib/types/posts';

export type PostFormData = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverUrl: string;
  status: PostStatus;
  featured: boolean;
  scheduledAt: string;
  tags: string[]; // 标签名称数组
};

export const emptyForm: PostFormData = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  coverUrl: '',
  status: PostStatus.DRAFT,
  featured: false,
  scheduledAt: '',
  tags: [],
};

/** 步骤条元数据（label + 图标由组件注入） */
export const EDITOR_STEPS = [
  { id: 1, label: '正文编辑' },
  { id: 2, label: '基本信息' },
] as const;

/**
 * 校验表单（保存前）。
 * @returns 错误消息；通过时返回 null
 */
export function validatePostForm(form: PostFormData): string | null {
  if (!form.title.trim()) return '标题必填';
  return null;
}

/**
 * 构造保存 payload。
 * - 定时发布：scheduledAt 空串 → null
 * - 编辑且内容留空 → 不传 content（服务端保持原值）
 */
export function buildPostPayload(form: PostFormData, isNewPost: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...form,
    scheduledAt: form.scheduledAt || null,
  };
  if (!isNewPost && !form.content) delete payload.content;
  return payload;
}
