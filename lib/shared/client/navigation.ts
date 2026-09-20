/**
 * 全局导航工具
 * 用于在使用 router.push() 时触发页面加载进度条
 */

/** 触发导航开始事件 */
export function triggerNavigationStart() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('navigationstart'));
  }
}

/** 触发导航结束事件 */
export function triggerNavigationEnd() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('navigationend'));
  }
}
