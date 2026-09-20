'use client';

/**
 * 定时任务表单状态机 hook（C11：manage-cron-jobs 交互拆分）。
 *
 * 收口：form 状态、创建/编辑切换、编辑详情回填、保存编排。
 * 数据模型 / 转换函数在 lib/cron/form.ts（jobToForm/formToConfig/DEFAULT_FORM）。
 * 保存成功后通过 onSaved 通知父组件刷新列表（避免 hook 依赖列表加载）。
 */
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  DEFAULT_FORM,
  formToConfig,
  jobToForm,
  formatScheduleArray,
  type FormState,
} from '@/lib/cron/shared';
import type { CronJob } from '@/lib/types/cron';

export function useCronForm({ onSaved }: { onSaved?: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const closeForm = () => {
    setShowForm(false);
    setEditingJobId(null);
  };

  const openCreateForm = () => {
    setForm(DEFAULT_FORM);
    setEditingJobId(null);
    setShowForm(true);
    setShowAdvanced(false);
  };

  /** 打开编辑表单：先按传入 job 填充，再拉详情完整回填（url/schedule/headers/auth/notification） */
  const openEditForm = async (job: CronJob) => {
    setForm(jobToForm(job));
    setEditingJobId(job.jobId);
    setShowForm(true);
    setShowAdvanced(true);

    // 兼容系统任务：即使传入的 job 只有 jobId/title，也能正确打开编辑表单
    try {
      const res = await fetch(`/api/admin/cron/jobs/${job.jobId}`);
      if (res.ok) {
        const data = await res.json();
        const detailed = data.job;
        if (detailed) {
          setForm((prev) => ({
            ...prev,
            title: detailed.title || prev.title,
            url: detailed.url || prev.url,
            enabled: detailed.enabled ?? prev.enabled,
            saveResponses: detailed.saveResponses ?? prev.saveResponses,
            requestMethod: detailed.requestMethod ?? prev.requestMethod,
            requestTimeout: detailed.requestTimeout ?? prev.requestTimeout,
            redirectSuccess: detailed.redirectSuccess ?? prev.redirectSuccess,
            schedule: detailed.schedule
              ? {
                  timezone: detailed.schedule.timezone || 'Asia/Shanghai',
                  minutes: formatScheduleArray(detailed.schedule.minutes),
                  hours: formatScheduleArray(detailed.schedule.hours),
                  mdays: formatScheduleArray(detailed.schedule.mdays),
                  months: formatScheduleArray(detailed.schedule.months),
                  wdays: formatScheduleArray(detailed.schedule.wdays),
                }
              : prev.schedule,
            headers: detailed.extendedData?.headers
              ? Object.entries(detailed.extendedData.headers).map(([key, value]) => ({
                  key,
                  value: value as string,
                }))
              : [],
            body: detailed.extendedData?.body || '',
            auth: detailed.auth
              ? {
                  enable: detailed.auth.enable ?? false,
                  user: detailed.auth.user || '',
                  password: detailed.auth.password || '',
                }
              : prev.auth,
            notification: detailed.notification
              ? {
                  onFailure: detailed.notification.onFailure ?? false,
                  onFailureCount: detailed.notification.onFailureCount ?? 1,
                  onSuccess: detailed.notification.onSuccess ?? false,
                  onDisable: detailed.notification.onDisable ?? false,
                  onSslCertExpiry: detailed.notification.onSslCertExpiry ?? false,
                  onSslCertExpirySeconds: detailed.notification.onSslCertExpirySeconds ?? 604800,
                }
              : prev.notification,
          }));
        }
      }
    } catch (e) {
      console.error('获取任务详情失败：', e);
    }
  };

  /** 保存任务（新建 POST / 编辑 PATCH），成功后通知父组件刷新 */
  const saveJob = async () => {
    if (!form.url.trim()) {
      showToast('任务 URL 是必填项', 'error');
      return;
    }

    setSaving(true);
    try {
      const config = formToConfig(form);
      const url = editingJobId ? `/api/admin/cron/jobs/${editingJobId}` : '/api/admin/cron/jobs';
      const method = editingJobId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: config }),
      });

      if (res.ok) {
        showToast(editingJobId ? '任务更新成功' : '任务创建成功', 'success');
        setShowForm(false);
        setEditingJobId(null);
        setTimeout(() => onSaved?.(), 500);
      } else {
        const data = await res.json();
        showToast(data.error || '保存失败', 'error');
      }
    } catch (e) {
      console.error('保存任务失败：', e);
      showToast('保存失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    setForm,
    showForm,
    setShowForm,
    editingJobId,
    saving,
    showAdvanced,
    setShowAdvanced,
    openCreateForm,
    openEditForm,
    saveJob,
    closeForm,
  };
}
