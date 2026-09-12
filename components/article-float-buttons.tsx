"use client";

import { useRouter } from "next/navigation";
import { ArrowUp, X } from "lucide-react";

/** 文章详情页悬浮按钮（对齐参考站 czhlove.cn）：
 * - 回到顶部按钮：hover 展示'回到顶部'中文文字提示
 * - 关闭按钮：点击回首页，hover 展示'关闭'中文文字提示
 * - PC端固定右下角（right-12 bottom-24），不与目录重叠
 * - 移动端固定右下角（right-4 bottom-24）
 * - 一直显示（不需要滚动才出现）
 * - 带过渡动画
 */
export function ArticleFloatButtons() {
  const router = useRouter();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeArticle = () => {
    router.push("/");
  };

  return (
    <div className="fixed right-4 bottom-24 md:right-12 md:bottom-24 flex flex-col gap-3 z-40">
      {/* 回到顶部 */}
      <button
        type="button"
        onClick={scrollToTop}
        className="group relative flex items-center justify-center"
        aria-label="回到顶部"
      >
        <span className="absolute right-full mr-3 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 pointer-events-none">
          回到顶部
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
        aria-label="关闭"
      >
        <span className="absolute right-full mr-3 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 pointer-events-none">
          关闭
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform duration-200 group-hover:scale-110">
          <X className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}
