"use client";

import { useEffect, useRef, useState } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { parserCtx, editorViewCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/prose/model";

/**
 * Markdown 编辑器组件（基于 Milkdown v7 + Crepe）
 *
 * 功能：
 * - CommonMark + GFM 语法支持
 * - 图片粘贴/拖拽上传（集成 T3 存储驱动）
 * - Crepe frame 主题
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
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const isInternalUpdate = useRef(false);
  const [editorReady, setEditorReady] = useState(false);

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
        setTimeout(() => {
          isInternalUpdate.current = false;
        }, 100);
      }
    } catch (error) {
      console.error("设置编辑器内容失败：", error);
    }
  }, [value, editorReady]);

  return (
    <div
      ref={containerRef}
      className="milkdown-editor-wrapper min-h-[300px] rounded-lg border border-border bg-background"
    />
  );
}
