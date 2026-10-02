'use client';

/**
 * 媒体库 Tabs 壳：图片 / 视频
 *
 * 挂载策略：只挂载当前激活 Tab，切换时卸载另一个并重新挂载 → 各自重新拉数据。
 * 图片 Tab 的上传弹窗/删除确认状态随卸载清空，属预期（不保留跨 Tab 状态）。
 */
import { useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { ManageMedia } from '@/components/manage/manage-media';
import { ManageVideos } from '@/components/manage/manage-videos';

const MEDIA_TABS = [
  { value: 'images', label: '图片' },
  { value: 'videos', label: '视频' },
] as const;

export type MediaTab = (typeof MEDIA_TABS)[number]['value'];

export function MediaTabs() {
  const [active, setActive] = useState<MediaTab>('images');

  return (
    <div className="space-y-4">
      <Tabs value={active} onChange={(v) => setActive(v as MediaTab)} items={[...MEDIA_TABS]} />
      {active === 'images' ? <ManageMedia /> : <ManageVideos />}
    </div>
  );
}
