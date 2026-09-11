/**
 * 四主题（T7.1）：浅色 / 深色 / 护眼 / 跟随系统（默认）
 * - 记忆：localStorage["theme"] = "light" | "dark" | "sepia" | "system"
 * - 应用：html.dark / html.sepia class（globals.css tokens），light 时两个 class 都移除，system 时按 prefers-color-scheme
 * - 首屏防 FOUC：layout.tsx head 内联 script（双端一致逻辑）
 */
export type ThemeMode = "light" | "dark" | "sepia" | "system";

export const THEME_KEY = "theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var c=document.documentElement.classList;if(t==='dark'){c.add('dark');c.remove('sepia');}else if(t==='sepia'){c.add('sepia');c.remove('dark');}else if(t==='light'){c.remove('dark');c.remove('sepia');}else{c.remove('dark');c.remove('sepia');if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){c.add('dark');}}}catch(e){}})();`;

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
  return t === "light" || t === "dark" || t === "sepia" ? t : "system";
}
