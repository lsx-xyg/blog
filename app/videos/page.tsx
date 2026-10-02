import type { Metadata } from 'next';
import { VideoMasonry } from '@/components/videos/video-masonry';
import { listPublicVideosWithPoster } from '@/lib/videos/server/public';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: '视频',
  description: '个人生活视频相册：旅行、日常与随手拍的片段。',
};

/** 前台视频瀑布流：首屏 SSR 直查库，后续由客户端无限滚动拉取 */
export default async function VideosPage() {
  // 多取 1 条判断 hasMore，与 /api/videos 同口径
  const items = await listPublicVideosWithPoster({ limit: PAGE_SIZE + 1 });
  const hasMore = items.length > PAGE_SIZE;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">视频</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          个人生活视频相册，记录旅行、日常与随手拍的片段。
        </p>
      </header>
      <VideoMasonry initial={items.slice(0, PAGE_SIZE)} hasMore={hasMore} pageSize={PAGE_SIZE} />
    </div>
  );
}
