/**
 * 引导锚点选择器生成：拾取元素时产出稳定的 CSS Selector
 *
 * 优先级（稳 → 脆）：
 * 1. #id —— 唯一且稳定时最好
 * 2. 语义属性 —— [aria-label] / [data-testid] / [name] / [placeholder] / [title] / [role]
 * 3. 唯一类组合 —— tag + 类名组合，取首个页面唯一的
 * 4. 类路径 + nth-child 兜底 —— 最脆弱，尽量避免
 *
 * 所有候选都经过「页面唯一性」校验（querySelectorAll 恰好 1 个），避免误定位。
 */

export type SelectorSource = "id" | "semantic" | "class" | "path";

export interface GeneratedSelector {
  /** 可直接用于 document.querySelector 的选择器字符串 */
  selector: string;
  /** 生成来源 */
  source: SelectorSource;
}

/** 语义属性优先级列表（值非空且唯一时采用） */
const SEMANTIC_ATTRS = [
  "aria-label",
  "data-testid",
  "name",
  "placeholder",
  "title",
  "role",
] as const;

/** 类路径兜底的最大深度（限制选择器长度，避免过长） */
const MAX_PATH_DEPTH = 8;

/** 转义属性值中的引号与反斜杠 */
function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** 转义 CSS 标识符（类名 / id），无 CSS.escape 时退化为基础替换 */
function escapeIdent(token: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(token);
  }
  return token.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

/** 页面唯一性校验：恰好命中 1 个元素 */
function isUnique(doc: Document, selector: string): boolean {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * 生成元素选择器（需在浏览器环境 / 有 DOM 的环境运行）
 * @returns 生成的 { selector, source }；无法生成时返回 null
 */
export function generateSelector(el: Element): GeneratedSelector | null {
  const doc = el.ownerDocument;

  // 1. id：唯一 id 最稳
  const id = el.getAttribute("id");
  if (id) {
    const sel = `#${escapeIdent(id)}`;
    if (isUnique(doc, sel)) return { selector: sel, source: "id" };
  }

  // 2. 语义属性
  for (const attr of SEMANTIC_ATTRS) {
    const value = el.getAttribute(attr);
    if (value && value.trim()) {
      const sel = `[${attr}="${escapeAttrValue(value)}"]`;
      if (isUnique(doc, sel)) return { selector: sel, source: "semantic" };
    }
  }

  // 3. 唯一类组合：tag + 类名从右到左累积，首个唯一的采用
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter(Boolean);
  if (classes.length > 0) {
    for (let i = classes.length; i > 0; i--) {
      const combo = classes
        .slice(0, i)
        .map((c) => `.${escapeIdent(c)}`)
        .join("");
      const sel = `${tag}${combo}`;
      if (isUnique(doc, sel)) return { selector: sel, source: "class" };
    }
  }

  // 4. 类路径 + nth-child 兜底
  const path = buildPath(el, doc);
  if (path) return { selector: path, source: "path" };

  return null;
}

/** 类路径兜底：tag[.class][:nth-child] > … 向上最多 MAX_PATH_DEPTH 层，整体唯一才采用 */
function buildPath(el: Element, doc: Document): string | null {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;

  while (cur && cur !== doc.documentElement && depth < MAX_PATH_DEPTH) {
    // 固定节点引用：闭包内不再引用可变的 cur，避免 TS 控制流收窄失效
    const node: Element = cur;
    const tag = node.tagName.toLowerCase();
    const classes = Array.from(node.classList)
      .slice(0, 2)
      .map((c) => `.${escapeIdent(c)}`)
      .join("");
    const parent = node.parentElement;
    let nth = "";
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === node.tagName,
      );
      if (siblings.length > 1) {
        nth = `:nth-child(${
          Array.from(parent.children).indexOf(node) + 1
        })`;
      }
    }
    parts.unshift(`${tag}${classes}${nth}`);
    cur = parent;
    depth++;
  }

  const selector = parts.join(" > ");
  return isUnique(doc, selector) ? selector : null;
}
