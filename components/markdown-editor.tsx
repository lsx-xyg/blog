"use client";

import { useEffect, useState } from "react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import type { BytemdPlugin } from "bytemd";
import type { HighlighterCore } from "@shikijs/core";
import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { Image as ImageIcon } from "lucide-react";
import { MediaPicker } from "@/components/media-picker";
import "bytemd/dist/index.css";

/**
 * 异步初始化 Shiki highlighter
 * 使用 JavaScript 引擎（无需 WASM），与详情页 (lib/mdx.tsx) 使用相同的 github-dark 主题
 */
async function createShikiHighlighter(): Promise<HighlighterCore> {
  const highlighter = await createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [import("shiki/themes/github-dark.mjs")],
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
function createShikiRehypePlugin(highlighter: HighlighterCore): BytemdPlugin {
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
              theme: "github-dark",
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
            }
          } catch (err) {
            console.error("[Shiki] 代码高亮失败:", err);
          }
        });
      }),
  };
}

/**
 * Markdown 编辑器组件（基于 ByteMD + Shiki）
 *
 * 功能：
 * - 源码手写 + 左右分屏实时预览
 * - GFM 支持（表格、任务列表、删除线）
 * - 代码高亮（Shiki github-dark 主题，与详情页一致）
 * - 图片粘贴/拖拽上传（集成 T3 存储驱动，自动保存到媒体库）
 * - 从媒体库选择已有图片（支持按文章图片/相册图片筛选）
 * - ByteMD 内置全屏模式
 * - 受控组件（value + onChange）
 *
 * 用法：
 * <MarkdownEditor value={content} onChange={setContent} />
 */
export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // 异步初始化 Shiki highlighter
  useEffect(() => {
    let cancelled = false;
    createShikiHighlighter()
      .then((h) => {
        if (!cancelled) setHighlighter(h);
      })
      .catch((err) => {
        console.error("Shiki highlighter 初始化失败：", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 上传图片到存储驱动 + 保存到媒体库
  const uploadImages = async (files: File[]) => {
    const results: { url: string; alt?: string; title?: string }[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "ARTICLE"); // 从编辑器上传默认是文章图片

        // 使用新的媒体库上传 API（自动保存到 media 表）
        const response = await fetch("/api/admin/media", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "上传失败");
        }

        const result = await response.json();
        results.push({
          url: result.url,
          alt: file.name,
          title: file.name,
        });
      } catch (error) {
        console.error("图片上传失败：", error);
        // 上传失败时尝试旧的上传 API（兼容）
        try {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (response.ok) {
            const result = await response.json();
            results.push({
              url: result.url,
              alt: file.name,
              title: file.name,
            });
          }
        } catch (e) {
          console.error("旧上传 API 也失败：", e);
        }
      }
    }

    return results;
  };

  // 从媒体库选择图片后，在内容末尾追加 Markdown 图片语法
  // TODO: 后续优化为在光标位置插入（需要 ByteMD 编辑器实例 API）
  const handleMediaSelect = (url: string, alt?: string) => {
    const markdown = `\n\n![${alt || "图片"}](${url})\n`;
    onChange(value ? `${value}${markdown}` : markdown);
  };

  // 构建插件列表（highlighter 就绪后才添加 Shiki 插件）
  const plugins: BytemdPlugin[] = [gfm()];
  if (highlighter) {
    plugins.push(createShikiRehypePlugin(highlighter));
  }

  // highlighter 未就绪时显示加载状态
  if (!highlighter) {
    return (
      <div className="min-h-[400px] rounded-lg border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">加载编辑器中...</p>
      </div>
    );
  }

  return (
    <div className="bytemd-editor-wrapper overflow-hidden rounded-lg border border-border bg-background">
      {/* 自定义工具栏：图片库按钮 */}
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
        <button
          type="button"
          onClick={() => setShowMediaPicker(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="从媒体库选择图片"
        >
          <ImageIcon className="h-4 w-4" />
          <span>图片库</span>
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          支持粘贴/拖拽上传，或点击「图片库」选择已有图片
        </div>
      </div>

      <Editor
        value={value}
        plugins={plugins}
        onChange={onChange}
        uploadImages={uploadImages}
        mode="split"
        placeholder="在此输入 Markdown 内容..."
      />

      {/* 媒体库选择器 */}
      <MediaPicker
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
