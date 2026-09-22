import { describe, expect, it, vi } from 'vitest';

// meta.ts 依赖链不含 db（纯函数），但保持与 site-url.test.ts 相同的 mock 风格以防未来引入
vi.mock('@/lib/settings/server', () => ({ getConfig: vi.fn() }));

import { buildHomeDescription, buildHomeTitle, buildExcerpt, buildPostDescription } from './meta';

describe('buildHomeTitle', () => {
  it('显式 seoTitle 配置优先', () => {
    expect(buildHomeTitle('林圣轩blog', '技术写作', '我的自定义标题内容')).toBe(
      '我的自定义标题内容',
    );
  });

  it('站名过短时自动拼上站点简介', () => {
    expect(buildHomeTitle('林圣轩blog', '技术写作与生活记录')).toBe(
      '林圣轩blog · 技术写作与生活记录',
    );
  });

  it('站名足够长时原样返回', () => {
    expect(buildHomeTitle('某某某的前端技术博客与生活记录', '技术写作与生活记录')).toBe(
      '某某某的前端技术博客与生活记录',
    );
  });

  it('站点简介为空且站名过短时不强拼', () => {
    expect(buildHomeTitle('短站名', '')).toBe('短站名');
  });
});

describe('buildHomeDescription', () => {
  it('描述足够长时原样返回', () => {
    const desc = '林圣轩blog，一个专注前端与全栈开发的技术博客，分享工程实践与生活记录。';
    expect(buildHomeDescription(desc, '技术写作与生活记录')).toBe(desc);
  });

  it('描述过短时用站点简介补足', () => {
    expect(buildHomeDescription('个人博客', '技术写作与生活记录')).toBe(
      '个人博客，技术写作与生活记录',
    );
  });

  it('seoDescription 已包含站点简介时不重复拼接', () => {
    expect(buildHomeDescription('技术写作与生活记录的个人博客', '技术写作与生活记录')).toBe(
      '技术写作与生活记录的个人博客',
    );
  });

  it('seoDescription 为空时回退站点简介', () => {
    expect(buildHomeDescription('', '技术写作与生活记录')).toBe('技术写作与生活记录');
  });

  it('描述超长时截断到 160 字符并加省略号', () => {
    const long = '字'.repeat(200);
    const result = buildHomeDescription(long, '');
    expect(result.length).toBe(160);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('buildPostDescription', () => {
  it('summary 足够长时直接使用', () => {
    const summary = '这是一段足够长的文章摘要，长度超过了三十个字符的最低要求，会被直接采用。';
    expect(buildPostDescription(summary, '# 正文\n内容')).toBe(summary);
  });

  it('summary 过短时拼上正文摘要', () => {
    const result = buildPostDescription(
      'Git Bash 支持中文',
      '## 配置步骤\n在 Git Bash 中设置中文编码。',
    );
    expect(result).toContain('Git Bash 支持中文');
    expect(result).toContain('在 Git Bash 中设置中文编码');
  });

  it('summary 缺失时回退正文摘要', () => {
    expect(buildPostDescription(null, '正文第一段内容。')).toBe('正文第一段内容。');
    expect(buildPostDescription('', '正文第一段内容。')).toBe('正文第一段内容。');
  });
});

describe('buildExcerpt', () => {
  it('去掉 Markdown 语法只留纯文本', () => {
    const md =
      '# 标题\n\n这是一段**加粗**的介绍，`代码`与[链接](https://a.b)都保留文字。\n\n```js\nconst a = 1;\n```\n\n后面的正文不应该进来因为超过限制了吗并不会刚好';
    const result = buildExcerpt(md);
    expect(result).not.toContain('#');
    expect(result).not.toContain('**');
    expect(result).not.toContain('```');
    expect(result).not.toContain('const a');
    expect(result).toContain('加粗');
    expect(result).toContain('链接');
  });

  it('超长截断加省略号', () => {
    const result = buildExcerpt('字'.repeat(200), 50);
    expect(result.length).toBe(51);
    expect(result.endsWith('…')).toBe(true);
  });

  it('空内容返回空串', () => {
    expect(buildExcerpt('')).toBe('');
  });
});
