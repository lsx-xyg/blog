"use client";

import { useEffect, useState } from "react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import "bytemd/dist/index.css";
import "highlight.js/styles/github-dark.css";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Markdown 编辑器组件（基于 ByteMD）
 *
 * 功能：
 * - 源码手写 + 左右分屏实时预览
 * - GFM 支持（表格、任务列表、删除线）
 * - 代码高亮（highlight.js github-dark 主题）
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
  const [mounted, setMounted] = useState(false);

  // 客户端挂载后再渲染编辑器，避免 SSR 水合问题
  useEffect(() => {
    setMounted(true);
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

  const plugins = [gfm(), highlight()];

  if (!mounted) {
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
