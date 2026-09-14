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

/** 清理标题中的 markdown 语法，只保留纯文本 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [链接](url) → 链接
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **加粗** → 加粗
    .replace(/\*([^*]+)\*/g, "$1") // *斜体* → 斜体
    .replace(/`([^`]+)`/g, "$1") // `代码` → 代码
    .replace(/~~([^~]+)~~/g, "$1") // ~~删除线~~ → 删除线
    .trim();
}

/** 从 Markdown 原文提取标题（# ## ###），跳过代码块 */
export function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  const idCount = new Map<string, number>();
  let inCodeBlock = false;

  for (const line of lines) {
    // 检测代码块边界（``` 或 ~~~）
    if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    // 跳过代码块内的内容
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const rawText = match[2].trim();
    const text = cleanMarkdown(rawText); // 清理 markdown 语法，只保留纯文本
    let id = slugify(text);

    // 处理重复 id（用原始 id 计数）
    const count = idCount.get(id) ?? 0;
    idCount.set(id, count + 1);
    if (count > 0) {
      id = `${id}-${count}`;
    }

    items.push({ id, text, level });
  }

  return items;
}
