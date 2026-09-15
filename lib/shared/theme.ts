/**
 * 四主题（对齐参考站 czhlove.cn）：浅色(light) / 深色(dark) / 护眼(warm) / 跟随系统(system)
 * - 记忆：localStorage["site-theme"] = "light" | "dark" | "warm" | "system"
 * - 应用：html.dark / html.theme-warm class（globals.css tokens），light 时不加 class，system 时按 prefers-color-scheme
 * - 首屏防 FOUC：layout.tsx head 内联 script（双端一致逻辑）
 * - 默认主题：跟随系统（systemDark→dark，否则→light）
 */
export type ThemeMode = "light" | "dark" | "warm" | "system";

export const THEME_KEY = "site-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var c=document.documentElement.classList;if(t==='dark'){c.add('dark');c.remove('theme-warm');}else if(t==='warm'){c.add('theme-warm');c.remove('dark');}else if(t==='light'){c.remove('dark');c.remove('theme-warm');}else{c.remove('dark');c.remove('theme-warm');if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){c.add('dark');}}}catch(e){}})();`;

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
  if (mode === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
  }
  if (mode === "light") {
    root.classList.remove("dark", "theme-warm");
  }
  localStorage.setItem(THEME_KEY, mode);
}

/** 读取已记忆主题（缺省 system） */
export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" || t === "warm" ? t : "system";
}
