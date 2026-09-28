import { describe, expect, it } from 'vitest';

import { extractToc } from './toc';

describe('extractToc', () => {
  it('提取 # / ## / ### 三级标题', () => {
    const md = ['# 一级', '## 二级', '### 三级'].join('\n');
    const items = extractToc(md);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ text: '一级', level: 1 });
    expect(items[1]).toMatchObject({ text: '二级', level: 2 });
    expect(items[2]).toMatchObject({ text: '三级', level: 3 });
  });

  it('跳过 #### 及更深层级（只取 1~3）', () => {
    const md = ['# 一', '#### 四级', '##### 五级'].join('\n');
    expect(extractToc(md)).toHaveLength(1);
  });

  it('跳过 ``` 代码块内的标题', () => {
    const md = ['# 真标题', '```', '# 假标题', '```', '## 真二级'].join('\n');
    const items = extractToc(md);
    expect(items.map((i) => i.text)).toEqual(['真标题', '真二级']);
  });

  it('跳过 ~~~ 代码块内的标题', () => {
    const md = ['# 外', '~~~', '# 内', '~~~'].join('\n');
    expect(extractToc(md)).toHaveLength(1);
  });

  it('清理标题中的 markdown 语法', () => {
    const md = ['# **加粗**和*斜体*', '# [链接文字](/url)', '# `代码`', '# ~~删除~~'].join('\n');
    const items = extractToc(md);
    expect(items[0].text).toBe('加粗和斜体');
    expect(items[1].text).toBe('链接文字');
    expect(items[2].text).toBe('代码');
    expect(items[3].text).toBe('删除');
  });

  it('slugify：中文保留，空格转连字符，特殊符号去除', () => {
    const item = extractToc('# 你好 世界！')[0];
    expect(item.id).toBe('你好-世界');
  });

  it('重复标题 id 追加 -1 / -2 后缀', () => {
    const md = ['# 同标题', '## 同标题', '### 同标题'].join('\n');
    const items = extractToc(md);
    expect(items.map((i) => i.id)).toEqual(['同标题', '同标题-1', '同标题-2']);
  });

  it('空内容 / 无标题返回空数组', () => {
    expect(extractToc('')).toEqual([]);
    expect(extractToc('纯文本\n没有标题')).toEqual([]);
  });
});
