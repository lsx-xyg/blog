"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { parserCtx, editorViewCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/prose/model";
import { Maximize2, Minimize2, Code, Eye } from "lucide-react";

/**
 * Markdown 编辑器组件（基于 Milkdown v7 + Crepe）
 *
 * 功能：
 * - CommonMark + GFM 语法支持
 * - 图片粘贴/拖拽上传（集成 T3 存储驱动）
 * - Crepe frame 主题
 * - 受控组件（value + onChange）
 * - 网页全屏模式
 * - Ctrl+/ 切换源码模式
 * - 自定义 Input Rule：![]() 语法自动转图片
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
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const isInternalUpdate = useRef(false);
  const [editorReady, setEditorReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceContent, setSourceContent] = useState(value);

  // 上传图片到存储驱动
  const uploadImage = async (file: File): Promise<string> => {
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
      return result.url;
    } catch (error) {
      console.error("图片上传失败：", error);
      return "";
    }
  };

  // 插入图片到编辑器
  const insertImage = useCallback((url: string, alt = "") => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const state = view.state;
      const { schema } = state;
      const imageNode = schema.nodes.image.create({ src: url, alt });
      const transaction = state.tr.replaceSelectionWith(imageNode);
      view.dispatch(transaction);
    });
  }, []);

  // 处理拖拽上传
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));

      for (const file of imageFiles) {
        const url = await uploadImage(file);
        if (url) {
          insertImage(url, file.name);
        }
      }
    },
    [insertImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: value,
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImage,
          inlineOnUpload: uploadImage,
          blockOnUpload: uploadImage,
        },
      },
    });

    // 监听内容变化
    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        if (isInternalUpdate.current) return;
        onChange(markdown);
        // 同步到源码模式
        setSourceContent(markdown);
      });
    });

    crepe.create().then(() => {
      crepeRef.current = crepe;
      setEditorReady(true);
    });

    return () => {
      crepe.destroy();
      crepeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 value 变化时同步到编辑器
  useEffect(() => {
    if (!editorReady) return;
    const crepe = crepeRef.current;
    if (!crepe) return;

    try {
      const currentMarkdown = crepe.getMarkdown();
      if (currentMarkdown !== value) {
        isInternalUpdate.current = true;
        crepe.editor.action((ctx) => {
          const parser = ctx.get(parserCtx) as (text: string) => Node;
          const view = ctx.get(editorViewCtx);
          const doc = parser(value);
          const state = view.state;
          view.dispatch(
            state.tr.replaceWith(0, state.doc.content.size, doc.content),
          );
        });
        setSourceContent(value);
        setTimeout(() => {
          isInternalUpdate.current = false;
        }, 100);
      }
    } catch (error) {
      console.error("设置编辑器内容失败：", error);
    }
  }, [value, editorReady]);

  // Ctrl+/ 切换源码模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        toggleSourceMode();
      }
      // ESC 退出全屏
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  // 切换源码模式
  const toggleSourceMode = () => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    if (!isSourceMode) {
      // 从 WYSIWYG 切到源码模式：同步当前内容到源码
      const markdown = crepe.getMarkdown();
      setSourceContent(markdown);
    }
    setIsSourceMode(!isSourceMode);
  };

  // 从源码模式切回 WYSIWYG 时，将源码同步到编辑器
  useEffect(() => {
    if (isSourceMode || !editorReady) return;
    const crepe = crepeRef.current;
    if (!crepe) return;

    try {
      isInternalUpdate.current = true;
      crepe.editor.action((ctx) => {
        const parser = ctx.get(parserCtx) as (text: string) => Node;
        const view = ctx.get(editorViewCtx);
        const doc = parser(sourceContent);
        const state = view.state;
        view.dispatch(
          state.tr.replaceWith(0, state.doc.content.size, doc.content),
        );
      });
      onChange(sourceContent);
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 100);
    } catch (error) {
      console.error("同步源码到编辑器失败：", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSourceMode]);

  // 源码模式内容变化
  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSourceContent(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div
      className={`milkdown-editor-wrapper relative ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-background p-4"
          : "min-h-[300px] rounded-lg border border-border bg-background"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-xs text-muted-foreground">
          {isSourceMode ? "源码模式" : "所见即所得"}
          <span className="ml-2 text-fg-faint">Ctrl+/ 切换</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSourceMode}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
            title={isSourceMode ? "切换到 WYSIWYG" : "切换到源码模式"}
          >
            {isSourceMode ? (
              <Eye className="h-4 w-4" />
            ) : (
              <Code className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
            title={isFullscreen ? "退出全屏" : "全屏编辑"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className={isFullscreen ? "h-[calc(100vh-120px)] overflow-auto" : "min-h-[260px]"}>
        {/* WYSIWYG 编辑器：始终渲染，用 CSS 隐藏/显示，避免 Crepe 实例失去挂载点 */}
        <div ref={containerRef} className={`p-2 ${isSourceMode ? "hidden" : ""}`} />
        {/* 源码模式 textarea：始终渲染，用 CSS 隐藏/显示 */}
        <textarea
          value={sourceContent}
          onChange={handleSourceChange}
          className={`h-full w-full resize-none bg-transparent p-4 font-mono text-sm outline-none ${
            isSourceMode ? "" : "hidden"
          }`}
          placeholder="在此输入 Markdown 源码，支持 ![]() 图片语法..."
          spellCheck={false}
        />
      </div>
    </div>
  );
}
