'use client';

import dynamic from 'next/dynamic';

/**
 * 评论组件延迟加载（Client Component）
 *
 * 因为 Next.js 15 中 Server Component 不能使用 ssr: false 的 next/dynamic，
 * 所以需要创建一个 Client Component 来包裹 Comments 组件的延迟加载。
 *
 * giscus 是第三方脚本，体积较大，不需要在服务端渲染，
 * 使用 ssr: false 只在客户端加载，不影响首屏渲染和 SEO。
 */

/** giscus 配置类型（与 components/posts/comments.tsx 中的类型保持一致） */
type GiscusConfig = {
  repo?: string;
  repoId?: string;
  category?: string;
  categoryId?: string;
};

// 评论组件延迟加载（giscus 第三方脚本体积较大，不影响首屏渲染）
// ssr: false - 只在客户端加载，避免服务端渲染时加载第三方脚本
const Comments = dynamic(() => import('@/components/posts/comments').then((mod) => mod.Comments), {
  ssr: false,
  loading: () => (
    <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="mt-4 text-sm text-muted-foreground">评论加载中...</p>
    </div>
  ),
});

export function CommentsLazy({ config }: { config: GiscusConfig }) {
  return <Comments config={config} />;
}
