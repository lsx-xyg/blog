"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/shared/utils";

/**
 * 通用懒加载图片组件（基于 Next.js Image）
 *
 * 功能：
 * - 使用 Next.js Image 组件自动优化图片（格式转换、尺寸调整、懒加载）
 * - 图片加载前显示占位符（背景色 + 脉冲动画）
 * - 图片加载完成后淡入显示
 * - 支持自定义占位符颜色
 * - 支持点击查看大图（可选）
 * - 加载失败显示提示
 *
 * 用法：
 * <LazyImage src="/image.jpg" alt="图片" className="w-full h-auto" />
 * <LazyImage src="/image.jpg" alt="图片" placeholderColor="#f0f0f0" />
 * <LazyImage src="/image.jpg" alt="图片" width={800} height={600} />
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
  /** 图片宽度（可选，不填则使用 fill 模式） */
  width?: number;
  /** 图片高度（可选，不填则使用 fill 模式） */
  height?: number;
  /** 是否在加载时显示脉冲动画（默认 true） */
  showSkeleton?: boolean;
  /** 点击图片的回调（可选） */
  onClick?: () => void;
  /** 图片加载完成的回调 */
  onLoad?: () => void;
  /** 图片加载失败的回调 */
  onError?: () => void;
  /** 图片对象适配方式（默认 cover） */
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
}

export function LazyImage({
  src,
  alt,
  className,
  placeholderColor,
  width,
  height,
  showSkeleton = true,
  onClick,
  onLoad,
  onError,
  objectFit = "cover",
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

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

  // 判断是否使用 fill 模式（没有指定 width 或 height 时）
  const useFill = !width || !height;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
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

      {/* Next.js Image 组件（自动优化、懒加载） */}
      {!hasError && (
        <Image
          src={src}
          alt={alt}
          width={useFill ? undefined : width}
          height={useFill ? undefined : height}
          fill={useFill}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            objectFit,
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.5s ease-in-out",
          }}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      )}
    </div>
  );
}
