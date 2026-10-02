import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, CalendarDays, Tag as TagIcon, Clapperboard } from 'lucide-react';
import { VideoPlayer } from '@/components/videos/video-player';
import { getPublicVideoById } from '@/lib/videos/server/public';
import { resolvePlaybackUrl } from '@/lib/videos/server/playback';
import { getSiteUrlAsync } from '@/lib/seo/shared/site-url';
import { utcIsoToLocalDatetime } from '@/lib/videos/shared/datetime';

type Props = {
  params: Promise<{ id: string }>;
};

/** 同一请求内 generateMetadata 与页面共用一次 DB 查询（Next 请求级去重） */
async function loadVideo(id: string) {
  return getPublicVideoById(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const video = await loadVideo(id);
  if (!video) return { title: '视频不存在' };

  const baseUrl = await getSiteUrlAsync();
  const title = video.title || '视频';
  const description =
    video.description ||
    (video.tags.length > 0 ? `标签：${video.tags.join(' / ')}` : '个人生活视频');

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/videos/${video.id}`,
      type: 'video.other',
      ...(video.posterUrl ? { images: [{ url: video.posterUrl }] } : {}),
    },
    twitter: {
      card: video.posterUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(video.posterUrl ? { images: [video.posterUrl] } : {}),
    },
  };
}

export default async function VideoDetailPage({ params }: Props) {
  const { id } = await params;
  const video = await loadVideo(id);
  // 不存在或非 PUBLISHED + PUBLIC → 404（SQL 层已过滤，不泄露私有视频存在性）
  if (!video) notFound();

  // 播放 URL 只在服务端解析（公开直链 / 私有重签 24h），客户端只拿已签好的 URL
  const playbackUrl = await resolvePlaybackUrl(video);
  if (!playbackUrl) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {video.title || '未命名视频'}
        </h1>
        {video.description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground sm:text-base">
            {video.description}
          </p>
        ) : null}

        {/* 元信息行 */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
          {video.takenAt ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {utcIsoToLocalDatetime(video.takenAt)}
            </span>
          ) : null}
          {video.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {video.location}
            </span>
          ) : null}
          {video.tags.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <TagIcon className="h-3.5 w-3.5" />
              {video.tags.join(' · ')}
            </span>
          ) : null}
        </div>
      </div>

      {/* 播放器：preload=metadata + 自动静音 + 点击切静音 */}
      <VideoPlayer
        src={playbackUrl}
        poster={video.posterUrl || undefined}
        title={video.title || undefined}
      />

      {!video.posterUrl ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clapperboard className="h-3.5 w-3.5" />
          本视频暂无封面图
        </div>
      ) : null}
    </div>
  );
}
