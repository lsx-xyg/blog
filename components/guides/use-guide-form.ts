'use client';

/**
 * 引导表单状态机（新建/编辑共用）
 *
 * 职责：form 状态 + 校验 + 保存（含 keepEditing 语义）+ 拾取前自动保存 + 打开新建/编辑。
 * 校验规则收口在 lib/guides/client/validate.ts（可单测），组件只做网络副作用与状态流转。
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Guide, GuideStep } from '@/lib/types/guides';
import { normalizeTargetCondition } from '@/lib/types/guides';
import { buildGuidePickUrl } from '@/lib/guides/client';
import { useToast } from '@/components/ui/toast';
import { EMPTY_FORM, toStepForms, type FormState } from '@/lib/guides/client';
import { validateGuideForm } from '@/lib/guides/client';

export function useGuideForm(opts: {
  adminPath: string;
  /** 保存成功后刷新列表 */
  refresh: () => void;
}) {
  const { adminPath, refresh } = opts;
  const { showToast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');

  /** 保存引导；keepEditing 时保存成功不关表单（用于拾取前自动保存），返回新 guide id */
  const handleSave = useCallback(
    async (saveOpts?: { keepEditing?: boolean }): Promise<string | null> => {
      setError('');
      const validation = validateGuideForm(form);
      if (!validation.ok) {
        setError(validation.error ?? '校验失败');
        return null;
      }
      const steps = validation.steps as GuideStep[];

      setSaving(true);
      try {
        const targetCondition = {
          logic: form.logic,
          conditions: form.conditions.map((c) => ({
            field: c.field,
            op: c.op,
            value: c.value,
          })),
        };
        const payload = {
          guideKey: form.guideKey.trim(),
          title: form.title.trim(),
          page: form.page.trim(),
          priority: Number(form.priority) || 0,
          status: form.status,
          steps,
          targetCondition,
        };
        const url = form.id ? `/api/admin/guides/${form.id}` : '/api/admin/guides';
        const res = await fetch(url, {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '保存失败');
          return null;
        }
        const savedId = (data.guide?.id as string | undefined) ?? form.id;
        if (saveOpts?.keepEditing) {
          // 保存并保持编辑：更新 id（新建场景），不关表单，供拾取跳转使用
          if (savedId && savedId !== form.id) {
            setForm((f) => ({ ...f, id: savedId }));
          }
          return savedId ?? null;
        }
        setEditing(false);
        setForm(EMPTY_FORM);
        refresh();
        return savedId ?? null;
      } catch {
        setError('网络错误，请稍后重试');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [form, refresh],
  );

  /** 拾取前自动保存当前表单（含未入库的步骤/条件），成功后才跳转目标页 */
  const saveThenPick = useCallback(
    async (params: { stepId?: string; conditionIndex?: number }) => {
      const guideId = await handleSave({ keepEditing: true });
      if (!guideId) return; // 校验/保存失败已 setError 提示
      const pickUrl = buildGuidePickUrl(adminPath, form.page, {
        guideId,
        ...params,
      });
      if (!pickUrl) {
        setError('请先在「页面」下拉选择本引导适用的后台页面，再拾取');
        return;
      }
      showToast('已保存，正在跳转目标页面拾取…', 'success');
      router.push(pickUrl);
    },
    [adminPath, form.page, handleSave, router, showToast],
  );

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setError('');
    setEditing(true);
  }, []);

  /** 关闭表单（编辑/新建弹窗收起，清空草稿） */
  const closeForm = useCallback(() => {
    setEditing(false);
    setForm(EMPTY_FORM);
    setError('');
  }, []);

  const openEdit = useCallback((g: Guide) => {
    const tc = normalizeTargetCondition(g.targetCondition);
    setForm({
      id: g.id,
      guideKey: g.guideKey,
      title: g.title,
      page: g.page,
      priority: g.priority,
      status: g.status,
      logic: tc?.logic ?? 'and',
      conditions: tc?.conditions ?? [],
      steps: toStepForms(g.steps),
    });
    setError('');
    setEditing(true);
  }, []);

  return {
    saving,
    editing,
    form,
    setForm,
    error,
    setError,
    handleSave,
    saveThenPick,
    openCreate,
    openEdit,
    closeForm,
  };
}
