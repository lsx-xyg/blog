/**
 * 三主题（T7）：跟随系统（默认）/ 深色 / 护眼
 * - 记忆：localStorage["theme"] = "system" | "dark" | "sepia"
 * - 应用：html.dark / html.sepia class（globals.css tokens），system 时按 prefers-color-scheme
 * - 首屏防 FOUC：layout.tsx head 内联 script（lib/theme-init.ts 字符串，双端一致逻辑）
 */
export type ThemeMode = "system" | "dark" | "sepia";

export const THEME_KEY = "theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var c=document.documentElement.classList;if(t==='dark'){c.add('dark');c.remove('sepia');}else if(t==='sepia'){c.add('sepia');c.remove('dark');}else{c.remove('dark');c.remove('sepia');if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){c.add('dark');}}}catch(e){}})();`;

/** 应用主题到 html class（客户端调用） */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("sepia", mode === "sepia");
  if (mode === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
  }
  localStorage.setItem(THEME_KEY, mode);
}

/** 读取已记忆主题（缺省 system） */
export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(THEME_KEY);
  return t === "dark" || t === "sepia" ? t : "system";
}
