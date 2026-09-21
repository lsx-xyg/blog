import type { StorageDriverInterface, UploadResult } from '@/lib/types/storage';
import { generateKey } from '../utils';
import type { StorageSettings } from '@/lib/types/settings';

/** WebDAV 存储驱动（坚果云 / NAS / Alist / Nextcloud 等）
 *
 * 用原生 fetch 实现：PUT 上传、GET 下载、DELETE 删除、MKCOL 建目录，Basic Auth 鉴权。
 *
 * 定位：WebDAV 服务一般没有稳定的公网直链（坚果云有但限流、NAS 在内网），
 * 因此本驱动只用于**私有通道**（备份等），getUrl 抛错提示不可公开访问。
 *
 * config 来自 storage_profiles.config（JSONB，密码已加密存储）。
 */
export class WebdavStorageDriver implements StorageDriverInterface {
  name = 'webdav' as const;

  private config: StorageSettings['webdav'];

  constructor(config?: StorageSettings['webdav']) {
    this.config = config || {
      url: process.env.WEBDAV_URL || '',
      username: process.env.WEBDAV_USERNAME || '',
      password: process.env.WEBDAV_PASSWORD || '',
      directory: process.env.WEBDAV_DIRECTORY || '',
    };
  }

  /** 归一化服务地址（去掉末尾斜杠） */
  private get base(): string {
    return (this.config.url || '').replace(/\/+$/, '');
  }

  private get auth(): string {
    return `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
  }

  /** 构建完整路径（包含子目录），如 backups/2026/09/uuid.sql.gz */
  private buildPath(key: string): string {
    const dir = (this.config.directory || '').replace(/^\/+|\/+$/g, '');
    return dir ? `${dir}/${key}` : key;
  }

  private assertConfigured(): void {
    if (!this.base) throw new Error('WebDAV 档案未配置服务地址（url）');
    if (!this.config.username || !this.config.password) {
      throw new Error('WebDAV 档案未配置用户名或密码');
    }
  }

  /** 逐级确保目录集合存在（坚果云等服务不会自动创建父目录） */
  private async ensureCollection(path: string): Promise<void> {
    const segments = path.split('/').filter(Boolean);
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const res = await fetch(`${this.base}/${current}/`, {
        method: 'MKCOL',
        headers: { Authorization: this.auth },
      });
      // 405 = 目录已存在；301/200/201 = 成功或已存在，均可忽略
      if (!res.ok && res.status !== 405 && res.status !== 301) {
        throw new Error(`WebDAV 创建目录失败（${current}）：${res.status}`);
      }
    }
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    this.assertConfigured();

    const key = generateKey(filename);
    const fullPath = this.buildPath(key);

    // 确保父目录链存在（YYYY/MM 两级）
    const parent = fullPath.split('/').slice(0, -1).join('/');
    if (parent) {
      await this.ensureCollection(parent);
    }

    const res = await fetch(`${this.base}/${fullPath}`, {
      method: 'PUT',
      headers: {
        Authorization: this.auth,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(file),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`WebDAV 上传失败：${res.status} ${errorText.slice(0, 200)}`);
    }

    return {
      // 私有通道没有公开 URL：这里**不能**调 getUrl（会抛错，导致「文件已上传成功却被判失败」，
      // 还会让调用方跳过后续清理留下孤儿文件）。需要读取请走 download()。
      url: '',
      key,
      size: file.length,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();

    const res = await fetch(`${this.base}/${this.buildPath(key)}`, {
      method: 'DELETE',
      headers: { Authorization: this.auth },
    });

    // 404 = 文件不存在，视为删除成功
    if (!res.ok && res.status !== 404) {
      throw new Error(`WebDAV 删除失败：${res.status}`);
    }
  }

  /** WebDAV 无公开访问 URL（私有通道专用），需要展示时调用方应走服务端 download */
  getUrl(_key: string): string {
    throw new Error(
      'WebDAV 档案没有公开访问 URL（仅支持私有通道，如数据库备份），读取内容请用 download()；公开资源请使用 GitHub / S3(R2) / 本地档案。',
    );
  }

  async download(key: string): Promise<Buffer> {
    this.assertConfigured();

    const res = await fetch(`${this.base}/${this.buildPath(key)}`, {
      method: 'GET',
      headers: { Authorization: this.auth },
    });

    if (!res.ok) {
      throw new Error(`WebDAV 下载失败：${res.status}（key: ${key}）`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
