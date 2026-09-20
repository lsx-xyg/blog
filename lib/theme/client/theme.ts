import { ThemeMode, THEME_KEY } from '../shared/theme';

/** 应用主题到 html class（客户端调用） */

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('theme-warm', mode === 'warm');
  // theme-system 仅用于服务端/CSS 系统偏好兜底（globals.css @media prefers-color-scheme）
  root.classList.toggle('theme-system', mode === 'system');
  if (mode === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', dark);
  }
  if (mode === 'light') {
    root.classList.remove('dark', 'theme-warm');
  }
  localStorage.setItem(THEME_KEY, mode);
  // 同步写 cookie，供服务端 SSR 直接渲染 html class（消除 404 等路径的主题闪烁）
  document.cookie = `${THEME_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
} /** 读取已记忆主题（缺省 system） */

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const t = localStorage.getItem(THEME_KEY);
  return t === 'light' || t === 'dark' || t === 'warm' ? t : 'system';
}
