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
import "bytemd/dist/index.css";
import { Maximize2, Minimize2 } from "lucide-react";

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
 * - 图片粘贴/拖拽上传（集成 T3 存储驱动）
 * - 网页全屏模式
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);

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

  // 上传图片到存储驱动
  const uploadImages = async (files: File[]) => {
    const results: { url: string; alt?: string; title?: string }[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
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
      }
    }

    return results;
  };

  // ESC 退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

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
    <div
      className={`bytemd-editor-wrapper relative ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-background p-4"
          : "rounded-lg border border-border bg-background overflow-hidden"
      }`}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
        <div className="text-xs text-muted-foreground">
          Markdown 编辑器（源码 + 实时预览）
        </div>
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
          title={isFullscreen ? "退出全屏 (ESC)" : "全屏编辑"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ByteMD 编辑器 */}
      <div className={isFullscreen ? "h-[calc(100vh-120px)] overflow-auto" : ""}>
        <Editor
          value={value}
          plugins={plugins}
          onChange={onChange}
          uploadImages={uploadImages}
          mode="split"
          placeholder="在此输入 Markdown 内容..."
        />
      </div>
    </div>
  );
}
