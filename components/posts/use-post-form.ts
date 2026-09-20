'use client';

/**
 * 文章编辑表单状态机 hook（C10）。
 *
 * 收口：form 状态、步骤导航、标签加载、保存编排（新建/编辑分支 + toast + 跳转）。
 * 组件层只做 JSX 装配。payload 构造/校验在 lib/posts/shared/form.ts（纯函数）。
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { PostFormData, emptyForm, buildPostPayload, validatePostForm } from '@/lib/posts/shared';

export function usePostForm({
  postId,
  initialData,
  adminPath,
}: {
  postId: string | null;
  initialData?: PostFormData;
  adminPath: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState<PostFormData>(initialData ?? emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  // 全部已有标签（供 TagInput 下拉提示）
  const [allTags, setAllTags] = useState<{ id: string; name: string; slug: string }[]>([]);

  // 加载已有标签
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/tags')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('加载标签失败'))))
      .then((d) => {
        if (!cancelled) setAllTags(d.tags || []);
      })
      .catch(() => {
        /* 标签下拉提示加载失败不阻塞编辑，静默降级 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof PostFormData, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 2) {
      setCurrentStep(step);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validatePostForm(form);
    if (invalid) {
      setError(invalid);
      showToast(`保存失败：${invalid}`, 'error');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // 判断是新建还是编辑
      const isNewPost = postId === null;
      const payload = buildPostPayload(form, isNewPost);

      if (isNewPost) {
        // 新建文章
        const r = await fetch('/api/admin/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error(data?.error || `创建失败（${r.status}）`);
        }
      } else {
        // 编辑文章
        const r = await fetch(`/api/admin/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error(data?.error || `保存失败（${r.status}）`);
        }
      }

      // 保存成功后返回文章列表页
      showToast(
        `文章「${form.title.trim() || '未命名'}」${isNewPost ? '创建成功' : '保存成功'}`,
        'success',
      );
      router.push(`/${adminPath}/posts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      setError(msg);
      showToast(`保存失败：${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /** 返回文章列表页 */
  const goToList = () => router.push(`/${adminPath}/posts`);

  return {
    form,
    setForm,
    set,
    currentStep,
    goToStep,
    save,
    goToList,
    loading,
    error,
    allTags,
  };
}
