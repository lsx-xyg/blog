import { describe, it, expect, vi } from 'vitest';

// service.ts 依赖 @/db（加载时读 DATABASE_URL）；纯函数测试不触库，mock 掉 @/db
vi.mock('@/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import {
  parseGuideInput,
  parseGuidePatch,
  parseProgressInput,
  validatePublishedSteps,
  isValidStepList,
} from '@/lib/guides/server';
import { GuideStatus } from '@/lib/types/guides';

const validStep = { id: 's1', target: 'editor-save', title: '保存', content: '点击保存' };

describe('parseGuideInput（创建）', () => {
  it('合法输入归一化：status 缺省 DRAFT、priority 截断、trim', () => {
    const r = parseGuideInput({
      guideKey: '  tour_v1 ',
      title: ' 引导 ',
      page: '/editor',
      steps: [validStep],
      priority: 3.9,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.guideKey).toBe('tour_v1');
    expect(r.data.status).toBe(GuideStatus.DRAFT);
    expect(r.data.priority).toBe(3);
    expect(r.data.targetCondition).toBeNull();
  });

  it('缺 guideKey/title/page → 报错', () => {
    expect(parseGuideInput({ title: 'x', page: '/', steps: [validStep] }).ok).toBe(false);
    expect(parseGuideInput({ guideKey: 'k', page: '/', steps: [validStep] }).ok).toBe(false);
    expect(parseGuideInput({ guideKey: 'k', title: 'x', steps: [validStep] }).ok).toBe(false);
  });

  it('steps 非法（非数组/缺字段）→ 报错', () => {
    expect(parseGuideInput({ guideKey: 'k', title: 'x', page: '/', steps: 'no' }).ok).toBe(false);
    expect(parseGuideInput({ guideKey: 'k', title: 'x', page: '/', steps: [{ id: 's' }] }).ok).toBe(
      false,
    );
  });

  it('发布且 steps 为空 → 报错', () => {
    const r = parseGuideInput({
      guideKey: 'k',
      title: 'x',
      page: '/',
      steps: [],
      status: GuideStatus.PUBLISHED,
    });
    expect(r.ok).toBe(false);
  });

  it('targetCondition 非法 → 报错', () => {
    const r = parseGuideInput({
      guideKey: 'k',
      title: 'x',
      page: '/',
      steps: [validStep],
      targetCondition: { logic: 'and', conditions: [] },
    });
    expect(r.ok).toBe(false);
  });
});

describe('parseGuidePatch（更新，仅校验传入字段）', () => {
  it('只传 status 也通过，不要求其他字段', () => {
    const r = parseGuidePatch({ status: GuideStatus.PUBLISHED });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBe(GuideStatus.PUBLISHED);
    expect(r.data.guideKey).toBeUndefined();
  });

  it('空串 guideKey/title/page → 报错', () => {
    expect(parseGuidePatch({ guideKey: '  ' }).ok).toBe(false);
    expect(parseGuidePatch({ title: '' }).ok).toBe(false);
  });

  it('priority 非有限数 → 报错；非法 status → 报错', () => {
    expect(parseGuidePatch({ priority: Number.NaN }).ok).toBe(false);
    expect(parseGuidePatch({ status: 'NOPE' }).ok).toBe(false);
  });

  it('targetCondition 显式 null 允许（清空触发条件）', () => {
    const r = parseGuidePatch({ targetCondition: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.targetCondition).toBeNull();
  });
});

describe('parseProgressInput（进度上报）', () => {
  it('guideKey 必填', () => {
    expect(parseProgressInput({}).ok).toBe(false);
  });

  it('status 非法值 → 忽略；currentStep 负值截断为 0', () => {
    const r = parseProgressInput({ guideKey: 'k', status: 'NOPE', currentStep: -3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBeUndefined();
    expect(r.data.currentStep).toBe(0);
  });

  it('status 与 currentStep 都未提供 → 报错', () => {
    expect(parseProgressInput({ guideKey: 'k' }).ok).toBe(false);
  });

  it('合法输入通过', () => {
    const r = parseProgressInput({ guideKey: ' k ', status: 'completed', currentStep: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.guideKey).toBe('k');
    expect(r.data.currentStep).toBe(2);
  });
});

describe('validatePublishedSteps / isValidStepList', () => {
  it('发布校验：空/缺失为 false，非空为 true', () => {
    expect(validatePublishedSteps([])).toBe(false);
    expect(validatePublishedSteps(undefined)).toBe(false);
    expect(validatePublishedSteps(null)).toBe(false);
    expect(validatePublishedSteps([validStep])).toBe(true);
  });

  it('step 结构校验', () => {
    expect(isValidStepList([validStep])).toBe(true);
    expect(isValidStepList([{ id: 's', target: 't', title: 'x' }])).toBe(false);
    expect(isValidStepList('x')).toBe(false);
  });
});
