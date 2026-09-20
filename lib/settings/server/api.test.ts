import { describe, it, expect, vi } from 'vitest';

// service.ts 依赖 @/lib/settings（index）→ store/get-config → @/db（加载时读 DATABASE_URL）。
// 纯函数测试不触库，mock 掉 @/db 拦截环境变量检查。
vi.mock('@/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import {
  buildSettingsOps,
  toStorageForClient,
  toPrivateStorageForClient,
  toCronForClient,
} from '@/lib/settings/server';

/** 测试加密函数：能区分「敏感字段走加密」即可 */
const mockEncrypt = (v: string) => `enc(${v})`;

import type { StorageSettings } from '@/lib/types/settings';

const fullStorage = {
  driver: 'GITHUB',
  github: {
    owner: 'o',
    repo: 'r',
    branch: 'main',
    cdnBase: 'https://cdn.example.com',
    urlStyle: 'path',
    directory: 'uploads',
    token: 'ghp_secret',
  },
  s3: {
    endpoint: 'https://s3.example.com',
    bucket: 'b',
    region: 'ap-1',
    directory: 'd',
    accessKey: 'AK',
    secretKey: 'SK',
  },
  local: {
    uploadDir: 'public',
    directory: 'local',
  },
} as StorageSettings;

describe('toStorageForClient / toPrivateStorageForClient', () => {
  it('裁剪 token/accessKey/secretKey 明文，只出 configured 布尔', () => {
    const view = toStorageForClient(fullStorage);
    expect(view.github.tokenConfigured).toBe(true);
    expect(view.s3.accessKeyConfigured).toBe(true);
    expect(view.s3.secretKeyConfigured).toBe(true);
    expect(JSON.stringify(view)).not.toContain('ghp_secret');
    expect(JSON.stringify(view)).not.toContain('AK');
    expect(JSON.stringify(view)).not.toContain('SK');
  });

  it('未配置的敏感字段 configured 为 false', () => {
    const view = toStorageForClient({
      ...fullStorage,
      github: { ...fullStorage.github, token: '' },
      s3: { ...fullStorage.s3, accessKey: '', secretKey: '' },
    });
    expect(view.github.tokenConfigured).toBe(false);
    expect(view.s3.accessKeyConfigured).toBe(false);
    expect(view.s3.secretKeyConfigured).toBe(false);
  });

  it('私有存储与公开存储裁剪一致', () => {
    const view = toPrivateStorageForClient(fullStorage);
    expect(JSON.stringify(view)).not.toContain('ghp_secret');
  });
});

describe('toCronForClient', () => {
  it('secret/jobApiKey 只出 configured 布尔', () => {
    const view = toCronForClient({
      deployPlatform: 'VERCEL',
      secret: 's3cret',
      jobApiKey: 'k3y',
    });
    expect(view.secretConfigured).toBe(true);
    expect(view.jobApiKeyConfigured).toBe(true);
    expect(JSON.stringify(view)).not.toContain('s3cret');
  });
});

describe('buildSettingsOps 三分支规则', () => {
  it('普通字段：undefined/null 跳过，其余原样存', () => {
    const ops = buildSettingsOps({
      site: { name: '我的博客', description: null, seoDescription: undefined },
      social: { github: 'lsx-xyg' },
    });
    expect(ops.update).toContainEqual({ key: 'site.name', value: '我的博客' });
    expect(ops.update).toContainEqual({ key: 'social.github', value: 'lsx-xyg' });
    expect(ops.update.some((u) => u.key === 'site.description')).toBe(false);
    expect(ops.update.some((u) => u.key === 'site.seo_description')).toBe(false);
  });

  it('敏感字段：空串删除、值加密、undefined 跳过', () => {
    const ops = buildSettingsOps(
      {
        storage: {
          github: { token: 'ghp_new' },
        },
        cron: { secret: '' },
        privateStorage: { s3: { accessKey: undefined } },
      },
      mockEncrypt,
    );
    expect(ops.update).toContainEqual({ key: 'storage.github.token', value: 'enc(ghp_new)' });
    expect(ops.delete).toContain('cron.secret');
    expect(ops.update.some((u) => u.key === 'storage_private.s3.access_key')).toBe(false);
  });

  it('可选文本：空串删除、有值原样存（admin.path）', () => {
    const ops = buildSettingsOps({ adminPath: '' });
    expect(ops.delete).toContain('admin.path');
    const ops2 = buildSettingsOps({ adminPath: '/admin' });
    expect(ops2.update).toContainEqual({ key: 'admin.path', value: '/admin' });
  });

  it('driver 归一化大写 + deployPlatform 归一化 SERVER/VERCEL', () => {
    const ops = buildSettingsOps({
      storage: { driver: 's3' },
      cron: { deployPlatform: 'server' },
    });
    expect(ops.update).toContainEqual({ key: 'storage.driver', value: 'S3' });
    expect(ops.update).toContainEqual({ key: 'cron.deploy_platform', value: 'SERVER' });
  });

  it('github urlStyle（拼接方式）持久化，undefined 跳过', () => {
    const ops = buildSettingsOps({
      storage: { github: { urlStyle: 'at', cdnBase: 'https://cdn.jsdelivr.net/gh' } },
    });
    expect(ops.update).toContainEqual({ key: 'storage.github.url_style', value: 'at' });
    expect(ops.update).toContainEqual({
      key: 'storage.github.cdn_base',
      value: 'https://cdn.jsdelivr.net/gh',
    });
    expect(
      buildSettingsOps({ storage: { github: {} } }).update.some(
        (u) => u.key === 'storage.github.url_style',
      ),
    ).toBe(false);
  });

  it('giscus.enabled：布尔转字符串存储，undefined 跳过', () => {
    const ops = buildSettingsOps({
      giscus: { repo: 'lsx-xyg/blog', enabled: false },
    });
    expect(ops.update).toContainEqual({ key: 'giscus.enabled', value: 'false' });
    expect(ops.update).toContainEqual({ key: 'giscus.repo', value: 'lsx-xyg/blog' });
    const ops2 = buildSettingsOps({ giscus: { enabled: true } });
    expect(ops2.update).toContainEqual({ key: 'giscus.enabled', value: 'true' });
    expect(buildSettingsOps({ giscus: {} }).update.some((u) => u.key === 'giscus.enabled')).toBe(
      false,
    );
  });

  it('aboutContent 单独透出', () => {
    const ops = buildSettingsOps({ aboutContent: '## 关于我' });
    expect(ops.aboutContent).toBe('## 关于我');
    expect(buildSettingsOps({}).aboutContent).toBeUndefined();
  });

  it('无加密可用时（默认 encryptIfAvailable 返回原值）仍写入值', () => {
    const ops = buildSettingsOps({
      storage: { github: { token: 'plain' } },
    });
    expect(ops.update).toContainEqual({ key: 'storage.github.token', value: 'plain' });
  });
});
