"use client";

import { useEffect, useState } from "react";
import { List, Copy, Check } from "lucide-react";
import type { TocItem } from "@/lib/toc";
import { scrollToElement } from "@/lib/smooth-scroll";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** 文章目录（TOC）组件（对齐参考站 czhlove.cn）：
 * - PC端：右侧固定目录（top-24 固定位置，不垂直居中），标题'目录'+复制图标
 * - 不显示编号，直接展示原样内容，不同等级标题用缩进区分
 * - 移动端：底部按钮点击弹出目录对话框
 * - 点击目录项平滑滚动到对应标题
 * - IntersectionObserver 跟踪当前阅读位置
 */
export function ArticleToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // 跟踪当前阅读位置
  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // 手动同步高亮，确保点击后目录当前位置立即更新
      setActiveId(id);
      // 自定义平滑滚动，600ms，offset 100px（减去导航栏高度）
      scrollToElement(el, 100, 600);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (items.length === 0) return null;

  const TocList = () => (
    <ul className="space-y-2 text-base">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => scrollTo(item.id)}
            className={`text-left transition-colors leading-relaxed ${
              item.level === 1 ? "pl-0" : item.level === 2 ? "pl-4" : "pl-8"
            } ${
              activeId === item.id
                ? "font-bold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.text}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* PC端：右侧固定目录（xl 屏幕以上显示，避免和文章内容重叠；top-24 固定位置，right-6 不贴边） */}
      <aside className="hidden xl:block fixed right-6 top-24 w-52 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-lg">目录</h3>
          <button
            type="button"
            onClick={copyUrl}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="复制链接"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <TocList />
      </aside>

      {/* 移动端/中等屏幕：底部左下角按钮 + 弹出目录（xl 以下显示，与PC端目录互补） */}
      <div className="xl:hidden fixed bottom-28 left-4 z-40">
        <Sheet>
          <SheetTrigger className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg">
            <List className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] px-6">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>目录</span>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="p-1.5 rounded-md hover:bg-accent transition-colors"
                  aria-label="复制链接"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto max-h-[50vh] px-2 pb-6">
              <TocList />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
