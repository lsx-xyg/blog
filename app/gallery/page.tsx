import type { Metadata } from "next";
import { GalleryWall } from "@/components/media/gallery-wall";

export const metadata: Metadata = {
  title: "相册",
  description: "生活图片展示",
};

/**
 * 相册页面
 *
 * 功能：
 * - 瀑布流展示（1/2/3/4 列响应式）
 * - 无限滚动加载
 * - 标签 OR 筛选（隐藏式面板）
 * - 最新/精选切换
 * - 图片懒加载
 * - 点击查看大图
 *
 * 注意：页面本身是静态生成的，数据由客户端组件 GalleryWall 获取。
 * 这样可以利用 Next.js 的静态缓存，提升首屏加载速度。
 */
export default function GalleryPage() {
  return (
    <main className="container mx-auto px-4 py-8 md:py-12 animate-page-enter">
      {/* 相册瀑布流 */}
      <GalleryWall />
    </main>
  );
}
