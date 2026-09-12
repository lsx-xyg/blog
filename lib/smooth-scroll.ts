/** 自定义平滑滚动工具（用 requestAnimationFrame 实现，确保所有浏览器生效） */

/** easeInOutCubic 缓动函数 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 平滑滚动到指定 Y 坐标 */
export function smoothScrollTo(targetY: number, duration = 600): void {
  const startY = window.scrollY;
  const diff = targetY - startY;
  if (Math.abs(diff) < 1) return;

  const startTime = performance.now();

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + diff * eased);
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}

/** 平滑滚动到页面顶部 */
export function scrollToTop(duration = 600): void {
  smoothScrollTo(0, duration);
}

/** 平滑滚动到指定元素（减去导航栏高度偏移） */
export function scrollToElement(element: HTMLElement, offset = 100, duration = 600): void {
  const rect = element.getBoundingClientRect();
  const targetY = window.scrollY + rect.top - offset;
  smoothScrollTo(targetY, duration);
}
