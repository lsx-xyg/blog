/**
 * 主题初始化脚本（外部文件形式）
 *
 * 为什么需要外部文件：
 * - 内联脚本（dangerouslySetInnerHTML）在正常页面 SSR 输出时可同步执行，防 FOUC
 * - 但硬导航到 404 等页面时，Next.js 返回错误壳（<html id="__next_error__">），
 *   root layout 的 head 内容由客户端 React 动态插入——React 动态插入的
 *   内联脚本【不会执行】，而 <script src> 形式的脚本会被浏览器正常加载执行
 * - 因此用 src 形式作为兜底，保证所有渲染路径下主题都能正确初始化
 *
 * 逻辑与 lib/shared/theme.ts 中的 THEME_INIT_SCRIPT 保持一致，修改需同步。
 */
(function () {
  try {
    var t = localStorage.getItem('site-theme');
    var c = document.documentElement.classList;
    if (t === 'dark') {
      c.add('dark');
      c.remove('theme-warm');
    } else if (t === 'warm') {
      c.add('theme-warm');
      c.remove('dark');
    } else if (t === 'light') {
      c.remove('dark');
      c.remove('theme-warm');
    } else {
      // 默认跟随系统
      c.remove('dark');
      c.remove('theme-warm');
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        c.add('dark');
      }
    }
    // 同步写 cookie，供服务端 SSR 渲染 html 主题 class（消除 404 等路径的闪烁，一次性自愈）
    if (t) {
      document.cookie = 'site-theme=' + t + '; path=/; max-age=31536000; samesite=lax';
    }
  } catch (e) {
    /* localStorage 不可用时静默降级为默认主题 */
    console.error('localStorage 不可用，静默降级为默认主题', e);
  }
})();
