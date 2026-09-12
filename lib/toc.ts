/** 从 Markdown 内容提取标题生成目录（TOC） */
export type TocItem = {
  id: string;
  text: string;
  level: number; // 1/2/3
};

/** 简单 slugify：中文保留，空格转连字符 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** 从 Markdown 原文提取标题（# ## ###） */
export function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  const idCount = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    let id = slugify(text);

    // 处理重复 id
    const count = idCount.get(id) ?? 0;
    if (count > 0) {
      id = `${id}-${count}`;
    }
    idCount.set(id, count + 1);

    items.push({ id, text, level });
  }

  return items;
}
