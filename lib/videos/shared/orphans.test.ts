import { describe, expect, it } from 'vitest';
import { filterOrphanPosters } from './orphans';

describe('filterOrphanPosters（孤儿封面纯函数）', () => {
  const candidates = [
    { id: 'a1', url: 'https://cdn/a1.jpg' },
    { id: 'b2', url: 'https://cdn/b2.jpg' },
    { id: 'c3', url: 'https://cdn/c3.jpg' },
    { id: 'd4', url: 'https://cdn/d4.jpg' },
  ];

  it('无任何引用时全部是孤儿', () => {
    const orphans = filterOrphanPosters(candidates, new Set(), new Set());
    expect(orphans).toEqual(candidates);
  });

  it('被 videos.posterMediaId 引用的排除（含 DRAFT 也算引用）', () => {
    const orphans = filterOrphanPosters(candidates, new Set(['a1', 'b2']), new Set());
    expect(orphans.map((o) => o.id)).toEqual(['c3', 'd4']);
  });

  it('被文章内容引用的（url 维度）排除', () => {
    const orphans = filterOrphanPosters(candidates, new Set(), new Set(['https://cdn/c3.jpg']));
    expect(orphans.map((o) => o.id)).toEqual(['a1', 'b2', 'd4']);
  });

  it('两个维度任一命中即排除', () => {
    const orphans = filterOrphanPosters(
      candidates,
      new Set(['a1']),
      new Set(['https://cdn/b2.jpg']),
    );
    expect(orphans.map((o) => o.id)).toEqual(['c3', 'd4']);
  });

  it('空候选返回空数组', () => {
    expect(filterOrphanPosters([], new Set(), new Set())).toEqual([]);
  });
});
