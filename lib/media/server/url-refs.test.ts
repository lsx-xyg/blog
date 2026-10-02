import { describe, expect, it } from 'vitest';
import { extractImageUrls, urlToPathKey } from './url-refs';

describe('extractImageUrls', () => {
  it('提取 Markdown 图片 URL', () => {
    const md = '![封面](/m/2026/09/a.jpg)\n\n正文 ![alt](https://cdn.example.com/x.png)';
    expect(extractImageUrls(md)).toEqual(['/m/2026/09/a.jpg', 'https://cdn.example.com/x.png']);
  });

  it('提取 HTML img URL', () => {
    const html =
      '<p><img src="/m/2026/09/b.jpg" alt="图" /></p><img src="https://cdn.example.com/c.jpg">';
    expect(extractImageUrls(html)).toEqual(['/m/2026/09/b.jpg', 'https://cdn.example.com/c.jpg']);
  });

  it('混合 Markdown 与 HTML', () => {
    const mixed = '![a](/m/a.png) <img src="/m/b.png"> 无图文字';
    expect(extractImageUrls(mixed)).toEqual(['/m/a.png', '/m/b.png']);
  });

  it('无图片时返回空数组', () => {
    expect(extractImageUrls('纯文本，无图片')).toEqual([]);
  });
});

describe('urlToPathKey', () => {
  it('相对路径与 CDN 直链（同名文件）归一到同一键', () => {
    const rel = urlToPathKey('/m/2026/09/c9c5bc7748dc42aeb7f2d0dddbeafd95.jpg');
    const cdn = urlToPathKey(
      'https://cdn.jsdelivr.net/gh/lsx-xyg/public@main/assets/2026/09/c9c5bc7748dc42aeb7f2d0dddbeafd95.jpg',
    );
    expect(rel).toBe('09/c9c5bc7748dc42aeb7f2d0dddbeafd95.jpg');
    expect(cdn).toBe(rel);
  });

  it('忽略协议、域名与查询串', () => {
    const a = urlToPathKey('/m/2026/09/a.jpg');
    const b = urlToPathKey('https://cdn.example.com/assets/2026/09/a.jpg?w=100&h=80');
    expect(a).toBe(b);
  });

  it('不同文件名不相等', () => {
    expect(urlToPathKey('/m/2026/09/a.jpg')).not.toBe(urlToPathKey('/m/2026/09/b.jpg'));
  });

  it('无法解析时原样返回', () => {
    expect(urlToPathKey('not-a-url')).toBe('not-a-url');
  });
});
