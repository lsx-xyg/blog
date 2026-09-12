"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, X } from "lucide-react";

/** 文章详情页悬浮按钮（对齐参考站 czhlove.cn）：
 * - 回顶部按钮：hover 展示"Back to Top"文字提示
 * - 关闭按钮：点击回首页，hover 展示"Close"文字提示
 * - PC端固定右侧，移动端固定右下角
 * - 带过渡动画
 */
export function ArticleFloatButtons() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeArticle = () => {
    router.push("/");
  };

  return (
    <div
      className={`fixed right-4 bottom-24 md:right-8 md:bottom-auto md:top-1/2 md:-translate-y-1/2 flex flex-col gap-3 z-40 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-4"
      }`}
    >
      {/* 回顶部 */}
      <button
        type="button"
        onClick={scrollToTop}
        className="group relative flex items-center justify-center"
        aria-label="回到顶部"
      >
        <span className="absolute right-full mr-3 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 pointer-events-none">
          Back to Top
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform duration-200 group-hover:scale-110">
          <ArrowUp className="h-5 w-5" />
        </span>
      </button>

      {/* 关闭（回首页） */}
      <button
        type="button"
        onClick={closeArticle}
        className="group relative flex items-center justify-center"
        aria-label="关闭文章"
      >
        <span className="absolute right-full mr-3 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 pointer-events-none">
          Close
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform duration-200 group-hover:scale-110">
          <X className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}
