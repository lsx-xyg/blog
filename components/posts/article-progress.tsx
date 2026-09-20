'use client';

/**
 * 文章阅读进度条组件
 *
 * 功能：
 * - 在文章详情页显示阅读进度条
 * - 根据页面滚动位置计算文章内容的阅读进度（0%-100%）
 * - 只计算文章内容区域，不包括评论区（giscus）
 * - 固定在顶部导航栏下方，滚动时一直可见
 * - 颜色跟随三色主题
 * - 高度 3-4px
 * - 使用 requestAnimationFrame 优化性能
 *
 * 实现方式：
 * - 通过 CSS 选择器获取 <article> 元素
 * - 只计算文章内容区域的滚动进度
 * - 评论区加载不会影响进度条
 * - 当用户滚动到评论区时，进度条显示 100%
 * - 使用 requestAnimationFrame 避免频繁重渲染
 * - 使用 MutationObserver 监听文章内容高度变化（图片加载等）
 * - 只在文章详情页使用，其他页面不引入
 *
 * 计算公式：
 * - articleTop = article.offsetTop
 * - articleBottom = articleTop + article.offsetHeight
 * - scrollableHeight = articleBottom - articleTop - viewportHeight
 * - progress = (scrollY - articleTop) / scrollableHeight * 100
 * - 当 scrollY < articleTop 时，progress = 0
 * - 当 scrollY > articleBottom - viewportHeight 时，progress = 100
 */

import { useEffect, useState, useRef } from 'react';

interface ArticleProgressProps {
  /**
   * 文章内容区域的 CSS 选择器
   * 默认是 "article"，可以根据实际结构调整
   */
  selector?: string;
}

export function ArticleProgress({ selector = 'article' }: ArticleProgressProps) {
  const [progress, setProgress] = useState(0);
  // 是否显示进度条（文章内容比视口还短时不显示，避免一直是满的横线影响美观）
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const tickingRef = useRef(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  // 计算阅读进度（只计算文章内容区域）
  const calculateProgress = () => {
    tickingRef.current = false;

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;

    // 获取文章内容区域
    const article = articleRef.current;
    if (!article) {
      setProgress(0);
      setVisible(false);
      return;
    }

    // 计算文章内容区域的位置和高度
    const articleTop = article.offsetTop;
    const articleBottom = articleTop + article.offsetHeight;

    // 总可滚动高度（文章内容区域）
    const scrollableHeight = articleBottom - articleTop - viewportHeight;

    if (scrollableHeight <= 0) {
      // 文章内容比视口还短，不显示进度条（避免一直是满的横线影响美观）
      setProgress(0);
      setVisible(false);
      return;
    }

    // 文章内容足够长，显示进度条
    setVisible(true);

    // 计算进度（0%-100%）
    // 当 scrollY < articleTop 时，进度为 0
    // 当 scrollY > articleBottom - viewportHeight 时，进度为 100%
    const currentProgress = Math.min(
      100,
      Math.max(0, ((scrollY - articleTop) / scrollableHeight) * 100),
    );
    setProgress(currentProgress);
  };

  // 使用 requestAnimationFrame 优化 scroll 事件
  const onScroll = () => {
    if (!tickingRef.current) {
      tickingRef.current = true;
      rafRef.current = requestAnimationFrame(calculateProgress);
    }
  };

  // 初始化：获取文章元素，设置 MutationObserver
  useEffect(() => {
    // 获取文章内容区域
    const article = document.querySelector<HTMLElement>(selector);
    if (!article) {
      console.warn(`[ArticleProgress] 未找到选择器为 "${selector}" 的元素`);
      return;
    }
    articleRef.current = article;

    // 初始计算
    calculateProgress();

    // 监听 scroll 事件
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // 使用 MutationObserver 监听文章内容高度变化
    // 比如图片加载完成、字体加载完成等，都会导致文章高度变化
    mutationObserverRef.current = new MutationObserver(() => {
      // 文章内容变化时，重新计算进度
      onScroll();
    });

    mutationObserverRef.current.observe(article, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    // 监听图片加载完成事件
    const images = article.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', onScroll, { once: true });
        img.addEventListener('error', onScroll, { once: true });
      }
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
      images.forEach((img) => {
        img.removeEventListener('load', onScroll);
        img.removeEventListener('error', onScroll);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector]);

  return (
    <div
      className={`sticky top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none -mt-[3px] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      {/* 进度条背景（透明，不占视觉空间） */}
      <div className="absolute inset-0 bg-transparent" />

      {/* 进度条主体 */}
      <div
        className="h-full bg-[hsl(var(--ring))] transition-[width] duration-100 ease-out"
        style={{
          width: `${progress}%`,
        }}
      >
        {/* 末端轻微 glow */}
        <div
          className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[hsl(var(--ring))] to-transparent opacity-40"
          style={{ filter: 'blur(1px)' }}
        />
      </div>
    </div>
  );
}
