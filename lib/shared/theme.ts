/**
 * 四主题（对齐参考站 czhlove.cn）：浅色(light) / 深色(dark) / 护眼(warm) / 跟随系统(system)
 * - 记忆：localStorage["site-theme"] = "light" | "dark" | "warm" | "system"（客户端）
 * - 同步：cookie "site-theme"（服务端 SSR 用，root layout 据此渲染 html class，防 FOUC）
 * - 应用：html.dark / html.theme-warm class（globals.css tokens），light 时不加 class，system 时按 prefers-color-scheme
 * - 首屏防 FOUC：layout.tsx head 内联 script（双端一致逻辑）+ SSR 服务端 class + /theme-init.js 兜底
 * - 默认主题：跟随系统（systemDark→dark，否则→light）
 */
export type ThemeMode = "light" | "dark" | "warm" | "system";

export const THEME_KEY = "site-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var c=document.documentElement.classList;if(t==='dark'){c.add('dark');c.remove('theme-warm');}else if(t==='warm'){c.add('theme-warm');c.remove('dark');}else if(t==='light'){c.remove('dark');c.remove('theme-warm');}else{c.remove('dark');c.remove('theme-warm');if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){c.add('dark');}}if(t){document.cookie='${THEME_KEY}='+t+'; path=/; max-age=31536000; samesite=lax';}}catch(e){}})();`;

/**
 * 主题初始化脚本的外部文件路径（public/theme-init.js）
 *
 * 内联脚本在正常页面 SSR 时可同步执行；但 404 等错误壳路径下，
 * head 内容由客户端 React 动态插入，内联脚本不会执行，
 * 而 <script src> 形式的脚本会被浏览器正常加载执行，用作兜底。
 * 逻辑与 THEME_INIT_SCRIPT 保持一致，修改需同步 public/theme-init.js。
 */
export const THEME_INIT_SCRIPT_SRC = "/theme-init.js";

/** 应用主题到 html class（客户端调用） */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("theme-warm", mode === "warm");
  // theme-system 仅用于服务端/CSS 系统偏好兜底（globals.css @media prefers-color-scheme）
  root.classList.toggle("theme-system", mode === "system");
  if (mode === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
  }
  if (mode === "light") {
    root.classList.remove("dark", "theme-warm");
  }
  localStorage.setItem(THEME_KEY, mode);
  // 同步写 cookie，供服务端 SSR 直接渲染 html class（消除 404 等路径的主题闪烁）
  document.cookie = `${THEME_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * 服务端：根据 cookie 计算 html 上应渲染的主题 class
 * - dark → "dark"；warm → "theme-warm"；system → "theme-system"（CSS 媒体查询按系统偏好兜底）
 * - light/未设置 → ""（默认浅色，脚本按需修正）
 */
export function getThemeClassFromValue(value: string | undefined): string {
  if (value === "dark") return "dark";
  if (value === "warm") return "theme-warm";
  if (value === "system") return "theme-system";
  return "";
}

/** 读取已记忆主题（缺省 system） */
export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" || t === "warm" ? t : "system";
}
