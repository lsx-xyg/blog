/**
 * 自定义 404 页面
 *
 * 内容跟 Next.js 自带的 404 页面一样简洁，
 * 但是确保使用我们的主题系统（浅色/深色/护眼/跟随系统）。
 *
 * 主题初始化说明：
 * - 根布局（app/layout.tsx）head 中已有内联脚本 + 外部 /theme-init.js 兜底
 * - 硬导航到 404 时 Next.js 返回错误壳，head 内容由客户端动态插入，
 *   内联脚本不会执行，由 /theme-init.js（src 形式）保证主题正确应用
 * - 此页面是 Server Component，不维护任何主题状态
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-6xl font-bold tracking-tight text-foreground md:text-7xl">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">此页面无法找到</p>
    </div>
  );
}
