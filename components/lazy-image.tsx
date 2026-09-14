"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 通用懒加载图片组件
 *
 * 功能：
 * - 使用 Intersection Observer 检测图片是否进入视口
 * - 图片进入视口前显示占位符（背景色 + 脉冲动画）
 * - 图片加载完成后淡入显示
 * - 支持原生 loading="lazy" 作为兜底
 * - 支持响应式图片（srcset、sizes）
 * - 支持自定义占位符颜色
 * - 支持点击查看大图（可选）
 *
 * 用法：
 * <LazyImage src="/image.jpg" alt="图片" className="w-full h-auto" />
 * <LazyImage src="/image.jpg" alt="图片" placeholderColor="#f0f0f0" />
 */

interface LazyImageProps {
  /** 图片地址 */
  src: string;
  /** 图片描述 */
  alt: string;
  /** 自定义类名 */
  className?: string;
  /** 占位符背景色（默认使用主题的 muted 色） */
  placeholderColor?: string;
  /** 图片宽度（可选） */
  width?: number;
  /** 图片高度（可选） */
  height?: number;
  /** 响应式图片 srcset */
  srcSet?: string;
  /** 响应式图片 sizes */
  sizes?: string;
  /** 是否在加载时显示脉冲动画（默认 true） */
  showSkeleton?: boolean;
  /** 点击图片的回调（可选） */
  onClick?: () => void;
  /** 图片加载完成的回调 */
  onLoad?: () => void;
  /** 图片加载失败的回调 */
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className,
  placeholderColor,
  width,
  height,
  srcSet,
  sizes,
  showSkeleton = true,
  onClick,
  onLoad,
  onError,
}: LazyImageProps) {
  const imgRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 使用 Intersection Observer 检测图片是否进入视口
  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    // 如果浏览器不支持 Intersection Observer，直接显示图片
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "200px 0px", // 提前 200px 开始加载
        threshold: 0.01,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 图片加载完成
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // 图片加载失败
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className || ""}`}
      style={{
        backgroundColor: placeholderColor || "hsl(var(--muted))",
      }}
      onClick={onClick}
    >
      {/* 占位符/骨架屏 */}
      {!isLoaded && showSkeleton && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-muted/50" />
      )}

      {/* 加载失败提示 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <span className="text-xs text-muted-foreground">图片加载失败</span>
        </div>
      )}

      {/* 图片（进入视口后才加载） */}
      {isVisible && !hasError && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          srcSet={srcSet}
          sizes={sizes}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
