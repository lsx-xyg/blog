/**
 * MDX / Markdown 渲染基础设施（C10：markdown-editor 的 shiki 细节迁移）。
 *
 * 组件层只做装配；highlighter 初始化、rehype 高亮插件、主题解析全部纯函数化。
 */
import type { BytemdPlugin } from "bytemd";
import type { HighlighterCore } from "@shikijs/core";
import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import type { ThemeMode } from "@/lib/shared/theme";

/**
 * 异步初始化 Shiki highlighter
 * 使用 JavaScript 引擎（无需 WASM），预先加载所有可能的主题，支持动态切换
 */
export async function createShikiHighlighter(): Promise<HighlighterCore> {
  const highlighter = await createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [
      import("shiki/themes/github-light.mjs"),
      import("shiki/themes/github-dark.mjs"),
      import("shiki/themes/github-dark-dimmed.mjs"),
    ],
    langs: [
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/go.mjs"),
      import("shiki/langs/rust.mjs"),
      import("shiki/langs/java.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/xml.mjs"),
    ],
  });
  return highlighter;
}

/**
 * 创建同步的 Shiki 代码高亮 rehype 插件
 * 使用 highlighter.codeToHast 同步方法，避免异步 transformer 导致 ByteMD 预览返回 undefined
 */
export function createShikiRehypePlugin(
  highlighter: HighlighterCore,
  theme: string
): BytemdPlugin {
  return {
    rehype: (p) =>
      p.use(() => (tree: Root) => {
        visit(tree, "element", (node: Element) => {
          // 找到 <pre><code class="language-xxx">...</code></pre>
          if (node.tagName !== "pre") return;
          const codeEl = node.children[0];
          if (!codeEl || codeEl.type !== "element" || codeEl.tagName !== "code") return;

          // 提取语言
          const className = (codeEl.properties?.className as string[]) || [];
          const lang =
            className.find((c) => c.startsWith("language-"))?.replace("language-", "") ||
            "text";

          // 提取代码文本
          const code = codeEl.children
            .filter((c) => c.type === "text")
            .map((c) => (c as { value: string }).value)
            .join("");

          if (!code.trim()) return;

          try {
            // 使用同步方法 codeToHast 生成高亮后的 hast
            const hastRoot = highlighter.codeToHast(code, {
              lang: highlighter.getLoadedLanguages().includes(lang as any) ? lang : "text",
              theme,
            });

            // 从 Root 中提取 pre 元素
            const highlighted = hastRoot.children.find(
              (c): c is Element => c.type === "element" && c.tagName === "pre",
            );

            if (highlighted) {
              // 替换原来的 pre 元素
              node.tagName = highlighted.tagName;
              node.properties = highlighted.properties;
              node.children = highlighted.children as Element["children"];

              // 移除内联 style 属性，让 CSS 样式生效（与前台文章详情页保持一致）
              if (node.properties && "style" in node.properties) {
                delete node.properties.style;
              }
            }
          } catch (err) {
            console.error("[Shiki] 代码高亮失败:", err);
          }
        });
      }),
  };
}

/**
 * 获取当前生效的主题（解析 system 主题）
 */
export function getEffectiveTheme(mode: ThemeMode): "light" | "dark" | "warm" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}
