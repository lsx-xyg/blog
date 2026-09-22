/**
 * 首页/文章 meta 组装（纯函数，可单测）。
 *
 * 背景：Bing 站长工具（URL 检查）对 <title> 与 meta description 的长度有判定——
 * 标题过短（如只有站名 7 字）、描述过短（< 25 字）都会被标记为
 * 「标题太短」「Meta Description 太长或太短」。
 *
 * 这里的兜底策略（配置显式值优先，代码只在「过短」时补足）：
 * - buildHomeTitle：seoTitle 显式配置优先；站名过短时拼上站点简介。
 * - buildHomeDescription：seoDescription 过短时用站点简介补足，超长截断。
 * - buildExcerpt：文章缺 summary 时从 Markdown 正文提取纯文本摘要，
 *   避免 meta description 直接缺失（Bing 同样会标记「缺少描述」）。
 */

/** 标题判定过短的阈值（字符数） */
const MIN_TITLE_LENGTH = 15;
/** 描述判定过短的阈值（字符数，Bing 建议 25~160，取 30 留余量） */
const MIN_DESCRIPTION_LENGTH = 30;
/** 描述超长截断阈值（字符数） */
const MAX_DESCRIPTION_LENGTH = 160;

/** 首页 <title>：显式 seoTitle 优先；站名过短时自动拼上站点简介 */
export function buildHomeTitle(name: string, description: string, seoTitle?: string): string {
  const explicit = seoTitle?.trim();
  if (explicit) return explicit;

  let title = name.trim();
  if (title.length < MIN_TITLE_LENGTH) {
    const desc = description.trim();
    if (desc) title = `${title} · ${desc}`;
  }
  return title;
}

/** 首页 meta description：过短时用站点简介补足；超长截断加省略号 */
export function buildHomeDescription(seoDescription: string, description: string): string {
  let desc = seoDescription.trim() || description.trim();
  const extra = description.trim();

  if (desc.length < MIN_DESCRIPTION_LENGTH && extra && !desc.includes(extra)) {
    desc = desc ? `${desc}，${extra}` : extra;
  }
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    desc = `${desc.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
  }
  return desc;
}

/**
 * 文章页 meta description：summary 缺失或过短时从正文提取纯文本补足。
 *
 * 现实问题：作者常把 summary 写成「Git Bash 支持中文」这类 13 字短句，
 * 或者干脆不写——两者都会被 Bing 标记「Meta Description 太长或太短/缺少」。
 * 规则：summary 达标直接用；过短则拼上正文摘要；仍无则回退正文摘要。
 */
export function buildPostDescription(summary: string | null | undefined, markdown: string): string {
  const s = (summary ?? '').trim();
  if (s.length >= MIN_DESCRIPTION_LENGTH) return s;

  const excerpt = buildExcerpt(markdown);
  let desc = s && excerpt && !excerpt.startsWith(s) ? `${s}，${excerpt}` : s || excerpt;
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    desc = `${desc.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
  }
  return desc;
}

/**
 * 从 Markdown 正文提取纯文本摘要（文章无 summary 时的 meta description 兜底）。
 *
 * 处理：去代码块/行内代码/图片/链接语法（保留链接文字）/常见标记符号，压缩空白。
 */
export function buildExcerpt(markdown: string, max = 150): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, ' ')
    .replace(/[*_~>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
