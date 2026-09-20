import type { StorageDriverInterface, UploadResult } from '@/lib/types/storage';
import { generateKey } from '../utils';
import { StorageSettings } from '@/lib/types/settings';

/** GitHub 图床存储驱动（生产环境用）
 *
 * 上传到 GitHub 公开仓库，通过 jsDelivr CDN 加速访问
 * - 仓库：storage.github.owner/repo（可在后台动态配置）
 * - 分支：storage.github.branch
 * - 访问 URL：https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}
 *
 * 敏感信息（Token）加密存储在 DB 中，环境变量优先级最高：
 * - GITHUB_STORAGE_TOKEN（环境变量）
 * - storage.github.token（DB 加密存储）
 *
 * 优点：免费、jsDelivr CDN 全球加速、公开仓库可直接访问
 * 缺点：单文件最大 100MB（GitHub 限制）、API 调用有速率限制
 */
export class GithubStorageDriver implements StorageDriverInterface {
  name = 'github' as const;

  private config: StorageSettings['github'];

  constructor(config?: StorageSettings['github']) {
    this.config = config || {
      owner: process.env.GITHUB_STORAGE_OWNER || 'lsx-xyg',
      repo: process.env.GITHUB_STORAGE_REPO || 'public',
      branch: process.env.GITHUB_STORAGE_BRANCH || 'main',
      cdnBase: process.env.GITHUB_STORAGE_CDN_BASE || 'https://cdn.jsdelivr.net/gh',
      directory: process.env.GITHUB_STORAGE_DIRECTORY || '',
      token: process.env.GITHUB_STORAGE_TOKEN || '',
    };
  }

  private get token(): string {
    return this.config.token;
  }

  private get owner(): string {
    return this.config.owner;
  }

  private get repo(): string {
    return this.config.repo;
  }

  private get branch(): string {
    return this.config.branch;
  }

  private get cdnBase(): string {
    return this.config.cdnBase;
  }

  private get directory(): string {
    return this.config.directory || '';
  }

  /** 构建完整路径（包含子目录） */
  private buildPath(key: string): string {
    return this.directory ? `${this.directory}/${key}` : key;
  }

  /** 构建 jsDelivr CDN URL */
  getUrl(key: string): string {
    const fullPath = this.buildPath(key);
    return `${this.cdnBase}/${this.owner}/${this.repo}@${this.branch}/${fullPath}`;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    if (!this.token) {
      throw new Error('GITHUB_STORAGE_TOKEN 环境变量未设置');
    }

    const key = generateKey(filename);
    const fullPath = this.buildPath(key);
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fullPath}`;

    // base64 编码文件内容
    const content = file.toString('base64');

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `chore: upload image ${key}`,
        content,
        branch: this.branch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub 上传失败：${response.status} ${errorText}`);
    }

    return {
      url: this.getUrl(key),
      key,
      size: file.length,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    if (!this.token) {
      throw new Error('GITHUB_STORAGE_TOKEN 环境变量未设置');
    }

    const fullPath = this.buildPath(key);
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fullPath}`;

    // 先获取文件 sha
    const getResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!getResponse.ok) {
      // 文件不存在时静默忽略
      if (getResponse.status === 404) return;
      throw new Error(`GitHub 获取文件信息失败：${getResponse.status}`);
    }

    const fileInfo = await getResponse.json();
    const sha = fileInfo.sha;

    // 删除文件
    const deleteResponse = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `chore: delete image ${key}`,
        sha,
        branch: this.branch,
      }),
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(`GitHub 删除失败：${deleteResponse.status}`);
    }
  }

  /**
   * 下载文件内容（支持私有仓库）
   *
   * 使用 GitHub Contents API + Token 下载，不依赖公开访问 URL。
   * 对于小于 1MB 的文件，Contents API 直接返回 Base64 编码的内容。
   * 对于大于 1MB 的文件，自动切换到 Git Blob API 下载。
   */
  async download(key: string): Promise<Buffer> {
    if (!this.token) {
      throw new Error('GitHub Token 未设置，无法下载私有仓库文件');
    }

    const fullPath = this.buildPath(key);
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fullPath}?ref=${this.branch}`;

    // 先用 Contents API 获取文件内容
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`文件不存在：${fullPath}`);
      }
      const errorText = await response.text();
      throw new Error(`GitHub 下载失败：${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Contents API 返回的 content 字段是 Base64 编码的（仅小于 1MB 的文件）
    if (data.content) {
      // 移除换行符后解码
      const base64Content = data.content.replace(/\n/g, '');
      return Buffer.from(base64Content, 'base64');
    }

    // 如果没有 content 字段，可能是文件太大（>1MB），需要用 Git Blob API
    if (data.sha) {
      console.log(`[github-driver] 文件 ${fullPath} 大于 1MB，使用 Blob API 下载`);
      return this.downloadBlob(data.sha);
    }

    throw new Error(`GitHub API 返回格式异常，无法下载文件：${fullPath}`);
  }

  /**
   * 使用 Git Blob API 下载大文件（>1MB）
   *
   * Blob API 返回的内容也是 Base64 编码的，但没有 1MB 限制
   */
  private async downloadBlob(sha: string): Promise<Buffer> {
    const blobUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/git/blobs/${sha}`;

    const response = await fetch(blobUrl, {
      method: 'GET',
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub Blob 下载失败：${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.content) {
      const base64Content = data.content.replace(/\n/g, '');
      return Buffer.from(base64Content, 'base64');
    }

    throw new Error('GitHub Blob API 返回格式异常');
  }
}
