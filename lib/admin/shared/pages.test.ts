/**
 * 后台页面清单守护测试：
 * 扫描 app/[adminSlug] 目录（本地源码环境），断言静态清单 ADMIN_PAGES
 * 覆盖了全部一级静态路由 + 首页 + /posts/new；新增页面未同步清单时本测试失败。
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ADMIN_PAGES } from './pages';

const ADMIN_DIR = path.join(process.cwd(), 'app/[adminSlug]');

describe('admin-pages 清单', () => {
  it('包含首页与 /posts/new', () => {
    const paths = ADMIN_PAGES.map((p) => p.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/posts/new');
  });

  it('覆盖 app/[adminSlug] 下全部一级静态路由（本地源码环境）', () => {
    if (!existsSync(ADMIN_DIR)) return; // 部署环境无源码目录，跳过
    const dirs = readdirSync(ADMIN_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('('))
      .map((e) => `/${e.name}`);
    const listed = ADMIN_PAGES.map((p) => p.path);
    for (const d of dirs) {
      expect(listed, `目录 /${d} 未收录进 ADMIN_PAGES`).toContain(d);
    }
  });

  it('清单路径唯一且以 / 开头', () => {
    const paths = ADMIN_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) {
      expect(p.startsWith('/')).toBe(true);
    }
  });
});
