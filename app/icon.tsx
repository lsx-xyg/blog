import { cookies } from 'next/headers';

/**
 * 动态站点图标（favicon）：「林」字 + 主题配色。
 *
 * 主题通过 cookie `site-theme`（见 lib/shared/theme.ts）区分：
 * - light  → 白底深字（默认）
 * - dark   → 深底白字
 * - warm   → 米黄底深棕字（护眼）
 * - system → 中性深灰底白字（跟随系统时取最稳对比）
 *
 * 用 SVG 而非 ImageResponse：中文由浏览器用系统字体渲染，
 * 无需在构建/运行时内置字体文件，Vercel 上零额外开销。
 */
export const size = { width: 64, height: 64 };
export const contentType = 'image/svg+xml';

type ThemeColors = { bg: string; fg: string; ring: string };

const THEME_COLORS: Record<string, ThemeColors> = {
  // 对齐 globals.css：light 背景 0 0% 100% / 前景 240 10% 3.9%
  light: { bg: '#ffffff', fg: '#18181b', ring: '#e4e4e7' },
  // dark 背景 240 10% 3.9% / 前景 0 0% 98%
  dark: { bg: '#0a0a0b', fg: '#fafafa', ring: '#27272a' },
  // warm 背景 46 48% 96% / 前景 30 10% 20%
  warm: { bg: '#f7f1e3', fg: '#3a332b', ring: '#e6dcc3' },
  // system：中性深灰，浅/深系统下对比都稳
  system: { bg: '#1f1f23', fg: '#ffffff', ring: '#3f3f46' },
};

export default async function Icon() {
  const cookieStore = await cookies();
  const theme = cookieStore.get('site-theme')?.value ?? 'system';
  const c = THEME_COLORS[theme] ?? THEME_COLORS.system;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${c.bg}" stroke="${c.ring}" stroke-width="2"/>
  <text x="32" y="43" text-anchor="middle" font-family="'Noto Serif SC','Source Han Serif SC','Songti SC','SimSun',serif" font-size="38" font-weight="700" fill="${c.fg}">林</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // 动态内容按 cookie 主题输出，用 no-cache 让浏览器每次回源验证
      'Cache-Control': 'no-cache',
    },
  });
}
