import type { Metadata } from 'next';
import { GalleryWall } from '@/components/media/gallery-wall';
import { getSiteSettings } from '@/lib/settings/server';
import { getSiteUrlAsync } from '@/lib/seo/shared';

/** 动态生成相册页 metadata（站名进模板后缀，描述补足到 Bing 建议长度） */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const siteUrl = await getSiteUrlAsync();
  return {
    title: '相册 · 摄影与生活影像',
    description: `${site.name} 的相册：${site.description}。按标签浏览生活影像与精选图片。`,
    alternates: {
      canonical: `${siteUrl}/gallery`,
    },
  };
}

// ISR（增量静态再生）：与 about/links 一致，内容更新不频繁
export const revalidate = 300;

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
export default async function GalleryPage() {
  const site = await getSiteSettings();

  return (
    <main className="container mx-auto px-4 py-8 md:py-12 animate-page-enter">
      {/* 视觉上由瀑布流主导，不展示大标题；但保留语义化 H1 给搜索引擎
          （Bing 站长工具会检查「页面缺少 <h1>」，sr-only 即满足且不影响视觉） */}
      <h1 className="sr-only">{`相册 - ${site.name}`}</h1>
      {/* 相册瀑布流 */}
      <GalleryWall />
    </main>
  );
}
