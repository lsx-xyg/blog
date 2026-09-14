import { THEME_INIT_SCRIPT } from "@/lib/shared/theme";

/**
 * 自定义 404 页面
 *
 * 内容跟 Next.js 自带的 404 页面一样简洁，
 * 但是确保使用我们的主题系统（浅色/深色/护眼/跟随系统）。
 *
 * 为什么需要自定义 404 页面？
 * Next.js 自带的 404 页面可能没有正确应用我们的主题变量，
 * 导致主题切换不一致。自定义 404 页面使用根布局（app/layout.tsx），
 * 主题初始化脚本能正常运行，确保主题切换一致。
 *
 * 注意：
 * 1. 这个页面是 Server Component，不维护任何主题状态
 * 2. 主题切换完全由根布局中的主题初始化脚本和 ThemeToggle 组件控制
 * 3. 为了确保 404 页面也能正确应用主题，这里手动注入了 THEME_INIT_SCRIPT
 *    （虽然根布局已经注入了，但为了防止 404 页面的特殊渲染路径导致脚本不执行，
 *    这里再注入一次作为双重保险）
 */
export default function NotFound() {
  return (
    <>
      {/* 主题初始化脚本（双重保险，确保 404 页面也能正确应用主题） */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-foreground md:text-7xl">
          404
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          此页面无法找到
        </p>
      </div>
    </>
  );
}
