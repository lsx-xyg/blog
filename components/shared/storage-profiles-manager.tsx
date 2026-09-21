'use client';

/**
 * 存储档案池管理器（后台「存储设置」新界面）
 *
 * 结构：
 * 1. 存储档案列表 —— 每个档案 = 平台名 + 驱动 + 该驱动的配置；支持增删改、连通性测试
 * 2. 通道绑定 —— 文章图片 / 相册图片 / 数据库备份 三个用途各绑定一个档案
 *
 * 自管数据（独立于设置页的统一保存按钮）：档案与绑定的改动即时调用专属 API 生效。
 * 历史文件不受任何影响：/m 路由与删除接口按入库时记录的 storageDriver 平台解析。
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, FlaskConical, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { StorageDriverType, STORAGE_DRIVER_VALUES } from '@/lib/types/storage';
import {
  StorageChannel,
  STORAGE_CHANNEL_META,
  STORAGE_DRIVER_META,
} from '@/lib/storage/shared/channels';

type ProfileView = {
  name: string;
  driver: StorageDriverType;
  config: Record<string, string | boolean>;
};

type Bindings = Record<StorageChannel, string>;

/** 编辑态：secret 字段空串 = 保持原值 */
type Draft = {
  originalName: string; // '' = 新建
  name: string;
  driver: StorageDriverType;
  config: Record<string, string | boolean>;
};

/** 各驱动的字段定义 */
type FieldDef = {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  select?: Array<{ value: string; label: string }>;
  hint?: string;
};

const DRIVER_FIELDS: Record<string, FieldDef[]> = {
  [StorageDriverType.GITHUB]: [
    { key: 'owner', label: 'Owner', placeholder: '用户名/组织' },
    { key: 'repo', label: 'Repository', placeholder: '仓库名' },
    { key: 'branch', label: 'Branch', placeholder: 'main' },
    {
      key: 'cdnBase',
      label: 'CDN 前缀（cdnBase）',
      placeholder: 'https://raw.githubusercontent.com',
    },
    {
      key: 'urlStyle',
      label: 'URL 拼接方式',
      select: [
        { value: 'path', label: '普通路径（/{branch}/xxx）' },
        { value: 'at', label: 'jsDelivr 风格（@{branch}/xxx）' },
      ],
    },
    { key: 'directory', label: '仓库内子目录（可选）', placeholder: 'assets' },
    { key: 'token', label: 'Token', secret: true, hint: '留空保持当前值；清空后保存可移除' },
  ],
  [StorageDriverType.S3]: [
    {
      key: 'endpoint',
      label: 'Endpoint',
      placeholder: 'https://<account_id>.r2.cloudflarestorage.com',
    },
    { key: 'bucket', label: 'Bucket', placeholder: 'bucket 名称' },
    { key: 'region', label: 'Region', placeholder: 'auto' },
    {
      key: 'publicBase',
      label: '公开访问域名（publicBase）',
      placeholder: 'https://img.example.com',
      hint: 'R2 绑定自定义域名或 r2.dev 域名；备份等私有档案可不填',
    },
    { key: 'directory', label: 'Bucket 内子目录（可选）', placeholder: 'assets' },
    { key: 'accessKey', label: 'Access Key ID', secret: true },
    { key: 'secretKey', label: 'Secret Access Key', secret: true },
  ],
  [StorageDriverType.WEBDAV]: [
    { key: 'url', label: '服务地址', placeholder: 'https://dav.jianguoyun.com/dav/' },
    { key: 'username', label: '用户名' },
    { key: 'password', label: '密码', secret: true },
    { key: 'directory', label: '服务内子目录（可选）', placeholder: 'backups' },
  ],
  [StorageDriverType.LOCAL]: [
    { key: 'uploadDir', label: '上传根目录', placeholder: 'public/uploads' },
    { key: 'directory', label: '根目录内子目录（可选）', placeholder: 'assets' },
  ],
};

/** 通道的中文标签（bindings 对象键用） */
const CHANNEL_KEYS = Object.values(StorageChannel) as StorageChannel[];

export function StorageProfilesManager() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<ProfileView[]>([]);
  const [bindings, setBindings] = useState<Bindings | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [savingBinding, setSavingBinding] = useState(false);

  const inputClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
  const labelClass = 'block text-sm font-medium mb-1';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/storage/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
        setBindings(data.bindings ?? null);
      } else {
        showToast('加载存储档案失败', 'error');
      }
    } catch (e) {
      console.error('加载存储档案失败：', e);
      showToast('加载存储档案失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  /** 新建 / 编辑 */
  const openDraft = (profile?: ProfileView) => {
    if (profile) {
      setDraft({
        originalName: profile.name,
        name: profile.name,
        driver: profile.driver,
        config: { ...profile.config },
      });
    } else {
      setDraft({
        originalName: '',
        name: '',
        driver: StorageDriverType.S3,
        config: { region: 'auto' },
      });
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      showToast('档案名不能为空（小写字母/数字/中划线，如 r2）', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/storage/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          driver: draft.driver,
          config: draft.config,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('档案已保存，立即生效', 'success');
        setDraft(null);
        await load();
      } else {
        showToast(data.error || '保存失败', 'error');
      }
    } catch (e) {
      console.error('保存档案失败：', e);
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async (name: string) => {
    if (!confirm(`确定删除档案「${name}」？（不影响已上传的文件）`)) return;
    try {
      const res = await fetch(`/api/admin/storage/profiles?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('已删除', 'success');
        await load();
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch (e) {
      console.error('删除档案失败：', e);
      showToast('删除失败', 'error');
    }
  };

  const testProfile = async (name: string) => {
    setTesting(name);
    try {
      const res = await fetch('/api/admin/storage/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        // 删除失败（多为权限不全）不算完全连通：能读写但会留下无法清理的垃圾文件
        const deleteOk = data.steps?.delete !== false;
        showToast(
          `${deleteOk ? '连通正常' : '读写正常，但删除失败'}，耗时 ${data.latencyMs}ms（${data.urlNote}）`,
          deleteOk ? 'success' : 'error',
        );
        if (data.cleanupWarning) {
          showToast(data.cleanupWarning, 'error');
        }
      } else {
        showToast(`连通失败：${data.error}`, 'error');
      }
    } catch (e) {
      console.error('测试失败：', e);
      showToast('测试失败', 'error');
    } finally {
      setTesting('');
    }
  };

  /** 只提交被改动的通道：服务端会校验可见性与公开 URL，其它通道不受影响 */
  const saveBinding = async (channel: StorageChannel, profileName: string) => {
    setSavingBinding(true);
    try {
      const res = await fetch('/api/admin/storage/bindings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [channel]: profileName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBindings((prev) => (prev ? { ...prev, [channel]: profileName } : prev));
        showToast('绑定已保存，立即生效（历史图片不受影响）', 'success');
      } else {
        showToast(data.error || '保存绑定失败', 'error');
        // 失败时回读真实绑定：受控组件的 value 没变不会触发重渲染，否则下拉会停在错误选项上
        await load();
      }
    } catch (e) {
      console.error('保存绑定失败：', e);
      showToast('保存绑定失败', 'error');
      await load();
    } finally {
      setSavingBinding(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
        加载存储档案…
      </div>
    );
  }

  const driverLabel = (d: string) => STORAGE_DRIVER_META[d]?.label ?? d;

  return (
    <div className="space-y-8">
      {/* 档案列表 */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-medium">存储档案</h3>
            <p className="text-xs text-muted-foreground">
              每个档案是一份完整的存储配置（名字用平台名，如 github / r2 /
              webdav）。历史文件跟着入库时的平台走，改动不影响已有图片。
            </p>
          </div>
          <button
            type="button"
            onClick={() => openDraft()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <Plus className="size-4" /> 新增档案
          </button>
        </div>

        <div className="space-y-2">
          {profiles.map((p) => {
            const boundTo = CHANNEL_KEYS.filter((c) => bindings?.[c] === p.name).map(
              (c) => STORAGE_CHANNEL_META[c].label,
            );
            return (
              <div
                key={p.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold">
                      {p.name}
                    </code>
                    <span className="text-xs text-muted-foreground">{driverLabel(p.driver)}</span>
                    {boundTo.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {boundTo.join('、')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => testProfile(p.name)}
                    disabled={testing === p.name}
                    className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-all disabled:opacity-50"
                  >
                    {testing === p.name ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="size-3.5" />
                    )}
                    测试
                  </button>
                  <button
                    type="button"
                    onClick={() => openDraft(p)}
                    className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-all"
                  >
                    <Pencil className="size-3.5" /> 编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProfile(p.name)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-all"
                  >
                    <Trash2 className="size-3.5" /> 删除
                  </button>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              还没有档案，点「新增档案」创建第一个存储配置
            </p>
          )}
        </div>
      </div>

      {/* 编辑抽屉 */}
      {draft && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <h4 className="mb-3 font-medium">
            {draft.originalName ? `编辑档案：${draft.originalName}` : '新增档案'}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>档案名（平台名）</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value.toLowerCase() })}
                disabled={!!draft.originalName}
                className={inputClass}
                placeholder="如 r2 / webdav / github"
              />
            </div>
            <div>
              <label className={labelClass}>驱动类型</label>
              <select
                value={draft.driver}
                onChange={(e) =>
                  setDraft({ ...draft, driver: e.target.value as StorageDriverType, config: {} })
                }
                className={inputClass}
              >
                {STORAGE_DRIVER_VALUES.map((d) => (
                  <option key={d} value={d}>
                    {driverLabel(d)}（{STORAGE_DRIVER_META[d]?.description ?? ''}）
                  </option>
                ))}
              </select>
            </div>
            {(DRIVER_FIELDS[draft.driver] ?? []).map((f) => {
              const value = draft.config[f.key];
              const isSecret = !!f.secret;
              const secretConfigured = isSecret && typeof value === 'boolean' ? value : undefined;
              const inputValue = isSecret
                ? typeof value === 'string'
                  ? value
                  : ''
                : String(value ?? '');
              return (
                <div key={f.key} className="md:col-span-2">
                  <label className={labelClass}>
                    {f.label}
                    {secretConfigured !== undefined && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        （{secretConfigured ? '已配置' : '未配置'}，留空保持不变）
                      </span>
                    )}
                  </label>
                  {f.select ? (
                    <select
                      value={String(value ?? f.select[0].value)}
                      onChange={(e) =>
                        setDraft({ ...draft, config: { ...draft.config, [f.key]: e.target.value } })
                      }
                      className={inputClass}
                    >
                      {f.select.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : isSecret ? (
                    <input
                      type="password"
                      value={inputValue}
                      onChange={(e) =>
                        setDraft({ ...draft, config: { ...draft.config, [f.key]: e.target.value } })
                      }
                      className={inputClass}
                      placeholder={secretConfigured ? '••••••••（留空保持当前值）' : '输入明文'}
                      autoComplete="new-password"
                    />
                  ) : (
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) =>
                        setDraft({ ...draft, config: { ...draft.config, [f.key]: e.target.value } })
                      }
                      className={inputClass}
                      placeholder={f.placeholder}
                    />
                  )}
                  {f.hint && <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 通道绑定 */}
      <div>
        <h3 className="font-medium">通道绑定</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          每个用途各绑一个档案；切换只影响新上传的文件，历史文件按入库时的平台解析。
        </p>
        {bindings && (
          <div className="grid gap-3 md:grid-cols-3">
            {CHANNEL_KEYS.map((channel) => {
              const meta = STORAGE_CHANNEL_META[channel];
              const usable = profiles.filter((p) => {
                const visibility = STORAGE_DRIVER_META[p.driver]?.visibility ?? [];
                if (!visibility.includes(meta.visibility)) return false;
                // 公开通道还要求档案真的有公开地址（S3/R2 需先配 publicBase），
                // 和服务端绑定校验保持一致，避免选了才报错
                if (meta.visibility === 'public' && p.driver === StorageDriverType.S3) {
                  return String(p.config.publicBase ?? '').trim() !== '';
                }
                return true;
              });
              const current = bindings[channel] ?? '';
              return (
                <div key={channel} className="rounded-lg border border-border p-3">
                  <label className={labelClass}>{meta.label}</label>
                  <p className="mb-2 text-xs text-muted-foreground">{meta.description}</p>
                  <select
                    value={current}
                    onChange={(e) => saveBinding(channel, e.target.value)}
                    disabled={savingBinding || usable.length === 0}
                    className={inputClass}
                  >
                    {current === '' && <option value="">（未绑定，用旧配置）</option>}
                    {usable.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}（{driverLabel(p.driver)}）
                      </option>
                    ))}
                  </select>
                  {usable.length === 0 && (
                    <p className="mt-1 text-xs text-destructive">
                      暂无可用档案：
                      {meta.visibility === 'public'
                        ? '公开通道需要 GitHub / 本地驱动，或已配置公开域名（publicBase）的 S3(R2) 档案'
                        : '请先新增一个私有档案（WebDAV / S3 / GitHub / 本地均可）'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
