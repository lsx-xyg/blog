/**
 * 媒体引用 URL 的提取与归一化
 *
 * 背景：media.url 存相对路径（如 /m/2026/09/xxx.jpg），而文章 coverUrl
 * 存 CDN 直链（如 https://cdn.jsdelivr.net/gh/xxx/public@main/assets/2026/09/xxx.jpg），
 * 两者文件名相同但前缀体系不同，字符串比较会漏判引用（导致封面图被误删）。
 * 统一做法：把 URL 归一化为「路径最后两段」（目录/文件名），再比较。
 */

/** 从 Markdown/HTML 正文中提取图片 URL */
export function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  // Markdown 图片 ![alt](url)
  const mdMatches = content.match(/!\[[^\]]*\]\(([^)]+)\)/g) || [];
  for (const match of mdMatches) {
    urls.push(match.replace(/!\[[^\]]*\]\(([^)]+)\)/, '$1'));
  }
  // HTML <img src="url">
  const htmlMatches = content.match(/<img[^>]+src=["']([^"']+)["']/g) || [];
  for (const match of htmlMatches) {
    urls.push(match.replace(/<img[^>]+src=["']([^"']+)["']/, '$1'));
  }
  return urls;
}

/**
 * 把 URL 归一化为可比较的引用键：取 pathname 的最后两段（目录/文件名）。
 * 相对路径（/m/2026/09/a.jpg）与 CDN 直链（.../assets/2026/09/a.jpg）
 * 归一到同一键「09/a.jpg」。带查询串/哈希的 URL 取 pathname，忽略 query。
 * 无法解析时原样返回，保证不漏判。
 */
export function urlToPathKey(url: string): string {
  try {
    const parsed = new URL(url, 'http://local');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    return parts.slice(-2).join('/');
  } catch {
    return url;
  }
}
