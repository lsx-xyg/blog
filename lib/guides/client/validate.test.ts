import { describe, expect, it } from 'vitest';
import { GuideConditionOp, GuideStatus } from '@/lib/types/guides';
import { EMPTY_FORM, type FormState } from './form-meta';
import { isConditionValid, validateGuideForm } from './validate';

function baseForm(): FormState {
  return {
    ...EMPTY_FORM,
    guideKey: 'test_v1',
    title: '测试引导',
    page: '/cron',
    steps: [
      {
        id: 'step_1',
        target: 'cron-save',
        title: '保存',
        content: '点这里',
        placement: 'bottom',
        nextRoute: '',
      },
    ],
  };
}

describe('isConditionValid', () => {
  it('click_count 空锚点无效', () => {
    expect(isConditionValid({ field: 'click_count.', op: GuideConditionOp.GTE, value: 1 })).toBe(
      false,
    );
    expect(
      isConditionValid({ field: 'click_count.cron-save', op: GuideConditionOp.GTE, value: 1 }),
    ).toBe(true);
  });

  it('非 exists 条件需有 value', () => {
    expect(isConditionValid({ field: 'page', op: GuideConditionOp.EQ, value: '' })).toBe(false);
    expect(isConditionValid({ field: 'page', op: GuideConditionOp.EQ, value: '/cron' })).toBe(true);
    // exists 不需要 value
    expect(
      isConditionValid({ field: 'user_age_days', op: GuideConditionOp.EXISTS, value: undefined }),
    ).toBe(true);
  });
});

describe('validateGuideForm', () => {
  it('必填项缺失报错', () => {
    const f = baseForm();
    f.title = '';
    const v = validateGuideForm(f);
    expect(v.ok).toBe(false);
    expect(v.error).toContain('必填项');
  });

  it('发布需至少一个步骤', () => {
    const f = baseForm();
    f.status = GuideStatus.PUBLISHED;
    f.steps = [];
    const v = validateGuideForm(f);
    expect(v.ok).toBe(false);
    expect(v.error).toContain('至少需要一个步骤');
  });

  it('草稿允许空步骤', () => {
    const f = baseForm();
    f.status = GuideStatus.DRAFT;
    f.steps = [];
    const v = validateGuideForm(f);
    expect(v.ok).toBe(true);
  });

  it('步骤不完整报错并指出序号', () => {
    const f = baseForm();
    f.steps[0].title = '';
    const v = validateGuideForm(f);
    expect(v.ok).toBe(false);
    expect(v.error).toContain('步骤 1');
  });

  it('步骤缺 target 但有 selector 视为完整', () => {
    const f = baseForm();
    f.steps[0].target = '';
    f.steps[0].selector = 'button.save';
    f.steps[0].selectorMeta = { source: 'class', generatedAt: '2026-01-01' };
    const v = validateGuideForm(f);
    expect(v.ok).toBe(true);
    expect(v.steps?.[0].selector).toBe('button.save');
  });

  it('条件至少一条且全部有效', () => {
    const f = baseForm();
    f.conditions = [];
    expect(validateGuideForm(f).ok).toBe(false);
    const g = baseForm();
    g.conditions = [{ field: 'page', op: GuideConditionOp.EQ, value: '' }];
    expect(validateGuideForm(g).ok).toBe(false);
  });

  it('通过时组装 GuideStep（trim + 兜底）', () => {
    const f = baseForm();
    const v = validateGuideForm(f);
    expect(v.ok).toBe(true);
    expect(v.steps?.[0]).toMatchObject({
      id: 'step_1',
      target: 'cron-save',
      placement: 'bottom',
    });
  });
});
