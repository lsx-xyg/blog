'use client';

import { useEffect, useRef, useState } from 'react';
import { Editor } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import type { BytemdPlugin } from 'bytemd';
import type { HighlighterCore } from '@shikijs/core';
import { Columns2, Pencil } from 'lucide-react';
import { MediaPicker } from '@/components/media/media-picker';
import 'bytemd/dist/index.css';
import { MediaType } from '@/lib/types/media';
import { uploadMediaFileXhr, runConcurrent } from '@/lib/media/client';
import { getStoredTheme } from '@/lib/theme/client';
import {
  createShikiHighlighter,
  createShikiRehypePlugin,
  getEffectiveTheme,
} from '@/lib/mdx/client';
import { ZH_LOCALE } from '@/lib/mdx/client';

/** lucide「图片」图标 16x16 inline SVG（ByteMD action 用） */
const IMAGE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

/**
 * 把「从媒体库选择图片」挂进 ByteMD 原生工具栏（plugin actions）。
 *
 * 背景：ByteMD 内置全屏只全屏 .bytemd 本身，wrapper 里自定义工具栏在全屏层之外、
 * 被全屏层盖住不可见，导致全屏时无法打开图片上传。把按钮注册为工具栏 action 后，
 * 按钮跟随 ByteMD 工具栏进入全屏层，全屏/非全屏均可用。
 */
function mediaPickerPlugin(onOpen: () => void): BytemdPlugin {
  return {
    actions: [
      {
        title: '从媒体库选择图片',
        icon: IMAGE_ICON_SVG,
        handler: {
          type: 'action',
          click: onOpen,
        },
      },
    ],
  };
}

/**
 * Markdown 编辑器组件（基于 ByteMD + Shiki）——C10 精简后只做装配
 *
 * 通用编辑器：文章编辑器与关于页编辑器共用（原 components/posts/markdown-editor.tsx，
 * about-editor.tsx 已并入本组件）。
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
 * shiki 初始化/插件/主题解析在 lib/mdx/client/shiki.ts，中文文案在 lib/mdx/client/locale.ts。
 * 用法：
 * <MarkdownEditor value={content} onChange={setContent} />
 * <MarkdownEditor value={content} onChange={setContent} uploadType={MediaType.ARTICLE} />
 */
export function MarkdownEditor({
  value,
  onChange,
  uploadType = MediaType.ARTICLE,
}: {
  value: string;
  onChange: (value: string) => void;
  /** 上传图片归入的媒体类型（决定走哪个存储通道），默认文章图片 */
  uploadType?: MediaType;
}) {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [editorMode, setEditorMode] = useState<'split' | 'tab'>('split');
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 主题状态
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark' | 'warm'>('dark');

  // 响应式：移动端默认 tab 模式（标签页切换），桌面端默认 split 模式（左右分屏）
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      setEditorMode(e.matches ? 'tab' : 'split');
    };

    // 初始设置
    setEditorMode(mediaQuery.matches ? 'tab' : 'split');

    // 监听变化
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 监听主题变化（使用 MutationObserver 监听 html 元素的 class 变化）
  useEffect(() => {
    // 初始获取主题
    const initialTheme = getStoredTheme();
    setEffectiveTheme(getEffectiveTheme(initialTheme));

    // 监听系统主题变化
    const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setEffectiveTheme((prev) => {
        // 只有当前是 system 模式时才更新
        const current = getStoredTheme();
        if (current === 'system') {
          return getEffectiveTheme('system');
        }
        return prev;
      });
    };
    systemMediaQuery.addEventListener('change', handleSystemThemeChange);

    // 监听 html 元素的 class 变化（主题切换时会修改 class）
    const observer = new MutationObserver(() => {
      const currentTheme = getStoredTheme();
      setEffectiveTheme(getEffectiveTheme(currentTheme));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      systemMediaQuery.removeEventListener('change', handleSystemThemeChange);
      observer.disconnect();
    };
  }, []); // 空依赖数组，只运行一次

  // 异步初始化 Shiki highlighter（只创建一次，预先加载所有主题）
  useEffect(() => {
    let cancelled = false;

    createShikiHighlighter()
      .then((h) => {
        if (!cancelled) setHighlighter(h);
      })
      .catch((err) => {
        console.error('Shiki highlighter 初始化失败：', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 上传图片到存储驱动 + 保存到媒体库（多文件并发，限制 3；失败降级旧 API，顺序按原数组）
  const uploadImages = async (files: File[]) => {
    const results: ({ url: string; alt?: string; title?: string } | null)[] = new Array(
      files.length,
    ).fill(null);

    await runConcurrent(files, 3, async (file, index) => {
      try {
        const r = await uploadMediaFileXhr(file, uploadType);
        if (r.ok) {
          results[index] = { url: r.url, alt: file.name, title: file.name };
          return;
        }
        throw new Error(r.error || '上传失败');
      } catch (error) {
        console.error('图片上传失败：', error);
        // 上传失败时尝试旧的上传 API（兼容）
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (response.ok) {
            const result = await response.json();
            results[index] = {
              url: result.url,
              alt: file.name,
              title: file.name,
            };
          }
        } catch (e) {
          console.error('旧上传 API 也失败：', e);
        }
      }
    });

    return results.filter((r): r is { url: string; alt?: string; title?: string } => r !== null);
  };

  // 从媒体库选择图片：优先在光标位置插入，编辑器实例不可用时兜底追加到末尾
  const insertMarkdown = (markdown: string) => {
    // ByteMD 底层是 CodeMirror 5，实例挂在 .CodeMirror 元素上（bytemd 内部同款遍历方式）
    const cmEl = wrapperRef.current?.querySelector<HTMLElement>('.CodeMirror') as
      | (HTMLElement & {
          CodeMirror?: { replaceSelection: (t: string) => void; focus: () => void };
        })
      | null
      | undefined;
    const editor = cmEl?.CodeMirror;
    if (editor) {
      // 有选区则替换选区，无选区在光标处插入；CodeMirror 自动派发 change → onChange
      editor.replaceSelection(markdown);
      editor.focus();
      return;
    }
    // 兜底：无编辑器实例（如预览/仅预览模式）→ 追加到末尾
    const sep = value && !value.endsWith('\n') ? '\n\n' : '\n';
    onChange(value ? `${value}${sep}${markdown}\n` : markdown);
  };

  const handleMediaSelect = (url: string, alt?: string) => {
    insertMarkdown(`![${alt || '图片'}](${url})`);
  };

  // 批量插入（多文件上传成功后）
  const handleMediaSelectMany = (items: { url: string; alt?: string }[]) => {
    const markdown = items.map((i) => `![${i.alt || '图片'}](${i.url})`).join('\n\n');
    insertMarkdown(markdown);
  };

  // 构建插件列表（highlighter 就绪后才添加 Shiki 插件）
  // 注意：preview 代码块使用固定的 github-dark 主题，与前台文章详情页保持一致
  const plugins: BytemdPlugin[] = [
    gfm(),
    // 图片库按钮挂进 ByteMD 原生工具栏——跟随全屏层，全屏时也可用
    mediaPickerPlugin(() => setShowMediaPicker(true)),
  ];
  if (highlighter) {
    plugins.push(createShikiRehypePlugin(highlighter, 'github-dark'));
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
      className="bytemd-editor-wrapper overflow-hidden rounded-lg border border-border bg-background"
      ref={wrapperRef}
    >
      {/* 自定义工具栏：模式切换（图片库入口已挂进 ByteMD 工具栏，全屏时可用） */}
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
        <div className="ml-auto flex items-center gap-1">
          {/* 模式切换按钮组 */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setEditorMode('tab')}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                editorMode === 'tab'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="编辑/预览标签页模式（推荐移动端）"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden md:inline">编辑</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('split')}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                editorMode === 'split'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="左右分屏模式（推荐桌面端）"
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">分屏</span>
            </button>
          </div>
          <span className="hidden lg:inline ml-2 text-xs text-muted-foreground">
            支持粘贴/拖拽上传，或点击「图片库」选择已有图片
          </span>
        </div>
      </div>

      <Editor
        key={`bytemd-editor-${effectiveTheme}`}
        value={value}
        plugins={plugins}
        onChange={onChange}
        uploadImages={uploadImages}
        mode={editorMode}
        placeholder="在此输入 Markdown 内容..."
        locale={ZH_LOCALE}
      />

      {/* 媒体库选择器 */}
      <MediaPicker
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
        onSelectMany={handleMediaSelectMany}
      />
    </div>
  );
}
