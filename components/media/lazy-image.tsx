'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/shared';

/**
 * 通用懒加载图片组件（基于 Next.js Image）
 *
 * 功能：
 * - 使用 Next.js Image 自动优化图片（格式转换、尺寸调整、懒加载）
 * - 图片加载前显示占位符（背景色 + 脉冲动画）
 * - 加载完成后淡入显示；加载失败显示提示
 * - 支持点击查看大图（可选）
 *
 * 三种渲染模式（`mode`）：
 * - `fill`：铺满父容器（object-fit 裁剪）。**要求父容器有确定尺寸**（如 aspect-video），
 *   否则容器高度为 0，图片会塌陷不可见
 * - `intrinsic`：已知原始宽高，按原始比例整宽显示（`w-full h-auto`），无布局抖动。
 *   传了 width + height 时默认用这个模式
 * - `natural`：宽高未知（如 Markdown 正文里外链的图片），整宽显示、比例交给图片自身决定
 *
 * 默认模式：有 width + height → `intrinsic`，否则 → `natural`（避免容器无高度时塌陷）
 *
 * 用法：
 * <LazyImage src="/a.jpg" alt="图" mode="fill" className="h-full w-full" />
 * <LazyImage src="/a.jpg" alt="图" width={1200} height={800} className="my-6 rounded-lg" />
 * <LazyImage src="/a.jpg" alt="图" mode="natural" className="my-6 rounded-lg" />
 */

export type LazyImageMode = 'fill' | 'intrinsic' | 'natural';

interface LazyImageProps {
  /** 图片地址 */
  src: string;
  /** 图片描述 */
  alt: string;
  /** 外层容器类名（fill 模式下需要该容器有确定尺寸） */
  className?: string;
  /** 传给 <img> 自身的类名 */
  imgClassName?: string;
  /** 占位符背景色（默认使用主题的 muted 色） */
  placeholderColor?: string;
  /** 渲染模式，不传则按 width/height 自动推断 */
  mode?: LazyImageMode;
  /** 图片宽度（intrinsic 模式必需） */
  width?: number;
  /** 图片高度（intrinsic 模式必需） */
  height?: number;
  /** 响应式 sizes，不传则按模式取默认值 */
  sizes?: string;
  /** 是否优先加载（LCP 图片用） */
  priority?: boolean;
  /** 输出质量（默认 Next 的 75） */
  quality?: number;
  /** 是否在加载时显示脉冲动画（默认 true） */
  showSkeleton?: boolean;
  /** 点击图片的回调（可选） */
  onClick?: () => void;
  /** 图片加载完成的回调 */
  onLoad?: () => void;
  /** 图片加载失败的回调 */
  onError?: () => void;
  /** 图片对象适配方式（默认 cover） */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

const DEFAULT_FILL_SIZES = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
/** natural 模式的占位比例（宽高未知；加载完成后浏览器按图片真实比例重排） */
const NATURAL_PLACEHOLDER_WIDTH = 1600;
const NATURAL_PLACEHOLDER_HEIGHT = 1200;

export function LazyImage({
  src,
  alt,
  className,
  imgClassName,
  placeholderColor,
  mode,
  width,
  height,
  sizes,
  priority = false,
  quality,
  showSkeleton = true,
  onClick,
  onLoad,
  onError,
  objectFit = 'cover',
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

  const resolvedMode: LazyImageMode = mode ?? (width && height ? 'intrinsic' : 'natural');
  const resolvedSizes = sizes ?? (resolvedMode === 'fill' ? DEFAULT_FILL_SIZES : '100vw');
  const fadeStyle: React.CSSProperties = {
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.5s ease-in-out',
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        backgroundColor: placeholderColor || 'hsl(var(--muted))',
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
      {!hasError && resolvedMode === 'fill' && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={resolvedSizes}
          priority={priority}
          quality={quality}
          decoding="async"
          className={imgClassName}
          onLoad={handleLoad}
          onError={handleError}
          style={{ objectFit, ...fadeStyle }}
        />
      )}

      {!hasError && resolvedMode === 'intrinsic' && (
        <Image
          src={src}
          alt={alt}
          width={width as number}
          height={height as number}
          sizes={resolvedSizes}
          priority={priority}
          quality={quality}
          decoding="async"
          className={cn('h-auto w-full', imgClassName)}
          onLoad={handleLoad}
          onError={handleError}
          style={{ objectFit, ...fadeStyle }}
        />
      )}

      {!hasError && resolvedMode === 'natural' && (
        <Image
          src={src}
          alt={alt}
          width={NATURAL_PLACEHOLDER_WIDTH}
          height={NATURAL_PLACEHOLDER_HEIGHT}
          sizes={resolvedSizes}
          priority={priority}
          quality={quality}
          decoding="async"
          className={cn('h-auto w-full', imgClassName)}
          onLoad={handleLoad}
          onError={handleError}
          style={{ objectFit, ...fadeStyle }}
        />
      )}
    </div>
  );
}
