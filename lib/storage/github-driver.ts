import type { StorageDriver, UploadResult } from "./types";
import { generateKey } from "./utils";

/** GitHub 图床存储驱动（生产环境用）
 *
 * 上传到 GitHub 公开仓库，通过 jsDelivr CDN 加速访问
 * - 仓库：GITHUB_IMAGE_REPO（默认 lsx-xyg/images）
 * - 分支：GITHUB_IMAGE_BRANCH（默认 main）
 * - 访问 URL：https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}
 *
 * 环境变量：
 * - GITHUB_TOKEN：GitHub Personal Access Token（需要 repo 权限）
 * - GITHUB_IMAGE_REPO：图床仓库（owner/repo 格式）
 * - GITHUB_IMAGE_BRANCH：分支名
 *
 * 优点：免费、jsDelivr CDN 全球加速、公开仓库可直接访问
 * 缺点：单文件最大 100MB（GitHub 限制）、API 调用有速率限制
 */
export class GithubStorageDriver implements StorageDriver {
  name = "github" as const;

  private get token(): string {
    return process.env.GITHUB_TOKEN || "";
  }

  private get repo(): string {
    return process.env.GITHUB_IMAGE_REPO || "lsx-xyg/images";
  }

  private get branch(): string {
    return process.env.GITHUB_IMAGE_BRANCH || "main";
  }

  /** 从 repo 字符串提取 owner 和 repo */
  private get ownerAndRepo(): { owner: string; repo: string } {
    const parts = this.repo.split("/");
    return { owner: parts[0] || "", repo: parts[1] || "" };
  }

  /** 构建 jsDelivr CDN URL */
  getUrl(key: string): string {
    const { owner, repo } = this.ownerAndRepo;
    return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${this.branch}/${key}`;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    if (!this.token) {
      throw new Error("GITHUB_TOKEN 环境变量未设置");
    }

    const key = generateKey(filename);
    const { owner, repo } = this.ownerAndRepo;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${key}`;

    // base64 编码文件内容
    const content = file.toString("base64");

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
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
      throw new Error("GITHUB_TOKEN 环境变量未设置");
    }

    const { owner, repo } = this.ownerAndRepo;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${key}`;

    // 先获取文件 sha
    const getResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github.v3+json",
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
      method: "DELETE",
      headers: {
        Authorization: `token ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
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
}
