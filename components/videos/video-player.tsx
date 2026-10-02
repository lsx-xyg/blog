'use client';

/**
 * 视频播放器（Step C2）
 *
 * - 自动静音播放（muted + autoPlay + playsInline，满足浏览器自动播放策略）
 * - 点击画面取消/恢复静音
 * - preload="metadata"（性能约束：不预载整段视频）
 * - 播放事件预留 viewCount 上报点（扩展点 4：本次不实现统计）
 */
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

type Props = {
  src: string;
  poster?: string;
  title?: string;
};

export function VideoPlayer({ src, poster, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  // 自动静音播放（浏览器自动播放策略要求 muted + playsInline）
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    const p = el.play();
    // 自动播放被浏览器拦截时静默等待用户交互（不报错不打扰）
    if (p) p.catch(() => {});
  }, []);

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    if (!el.muted) void el.play();
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-black">
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        title={title || undefined}
        preload="metadata"
        autoPlay
        muted
        playsInline
        controls
        className="aspect-video w-full"
        onClick={toggleMute}
        onPlaying={() => {
          setReady(true);
          // TODO 扩展点 4：播放次数上报（viewCount / play_events）——本次不实现
        }}
      />
      {/* 静音状态角标（点击画面切换静音时的视觉反馈） */}
      {ready ? (
        <button
          type="button"
          aria-label={muted ? '取消静音' : '静音'}
          onClick={toggleMute}
          className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}
