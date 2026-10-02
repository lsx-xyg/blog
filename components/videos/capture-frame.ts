/**
 * 视频截帧工具（客户端 DOM 逻辑，非纯函数——不写单测）
 *
 * 从视频源（本地 File/Blob 或远程 URL）截取一帧，作为未手动设置封面时的兜底封面。
 * - 远程 URL 截帧依赖服务器 CORS 放行（R2 已配 GET + AllowedHeaders），否则 canvas 被污染、toBlob 失败 → 返回 null
 * - 失败一律静默降级：返回 null，调用方继续"无封面"流程，不阻塞视频上传
 * - seek 到首帧（默认 0.1s，不超过时长 90%），按视频原始分辨率出图（JPEG 0.85）
 */
export type CapturedFrame = { blob: Blob; width: number; height: number };

export async function captureVideoFrame(
  source: string | Blob,
  seekTime = 0.1,
): Promise<CapturedFrame | null> {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    // 远程 URL 截帧需要 CORS 干净（R2 已放行 GET）
    if (typeof source === 'string') video.crossOrigin = 'anonymous';

    const cleanup = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      window.clearTimeout(timer);
    };
    const fail = () => {
      cleanup();
      resolve(null);
    };

    // 兜底超时：大视频 / 慢网络 20s 后放弃
    const timer = window.setTimeout(fail, 20_000);

    video.onloadeddata = () => {
      const duration = video.duration;
      const t = Number.isFinite(duration) && duration > 0 ? Math.min(seekTime, duration * 0.9) : 0;
      video.currentTime = t;
      video.onseeked = () => {
        try {
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            fail();
            return;
          }
          ctx.drawImage(video, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                cleanup();
                resolve({ blob, width: w, height: h });
              } else {
                fail();
              }
            },
            'image/jpeg',
            0.85,
          );
        } catch {
          fail();
        }
      };
    };
    video.onerror = fail;

    if (typeof source === 'string') {
      video.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      video.src = objectUrl;
    }
  });
}
