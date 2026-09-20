'use client';

import dynamic from 'next/dynamic';

/**
 * 引导管理器外层（懒加载入口）
 *
 * onborda 依赖 framer-motion（体积较大），通过 next/dynamic + ssr:false
 * 只在客户端按需加载，避免污染后台首屏体积。
 * 内层负责 Provider + 引导引擎，children 为后台页面内容。
 */
const GuideManagerInner = dynamic(
  () => import('./guide-manager-inner').then((m) => m.GuideManagerInner),
  { ssr: false, loading: () => null },
);

export function GuideManager({ children }: { children: React.ReactNode }) {
  return <GuideManagerInner>{children}</GuideManagerInner>;
}
