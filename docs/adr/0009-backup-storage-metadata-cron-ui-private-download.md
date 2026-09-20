# ADR-0009: 备份存储元数据、Cron UI 完善、私有仓库下载方案

- Status: **Accepted**
- Date: 2026-09-15

## Context

在存储架构公私分离重构（ADR-0008）完成后，实际使用中发现三个需要解决的问题：

### 问题 1：备份记录缺少存储平台信息

当前 `backup_records` 表只记录了 `fileKey`，没有记录备份存储在哪个平台（GitHub / S3 / Local）。如果用户切换了私有存储驱动（比如从 GitHub 切换到 S3），旧的备份还在 GitHub 上，但系统会尝试用当前配置的 S3 驱动去下载/删除，导致失败。

用户场景："有时候会备份到不同的平台比如本地/s3/github，但是都要记住才能操作"。

### 问题 2：Cron 配置 UI 不完善

后台设置页面中，GitHub Token、S3 Key 等敏感字段都有完善的 UI：

- ✓ 已配置状态提示（绿色文字）
- ✓ 小眼睛按钮切换明文/密文
- ✓ placeholder 提示"留空则保持当前配置"

但 Cron 配置部分的 `CRON_SECRET` 和 `CRON_JOB_API_KEY` 只是普通的密码输入框，没有这些功能，用户体验不一致。

### 问题 3：GitHub 私有仓库下载文件失败

当前备份下载逻辑是：

```typescript
const url = driver.getUrl(record.fileKey); // 返回 raw.githubusercontent.com 或 jsdelivr URL
const response = await fetch(url); // 私有仓库访问会 404！
```

对于公开仓库，这个逻辑没问题。但对于私有仓库：

- `raw.githubusercontent.com/owner/repo/branch/path` → 404（需要认证）
- `cdn.jsdelivr.net/gh/owner/repo@branch/path` → 404（jsDelivr 不支持私有仓库）

需要一个安全的方式下载私有仓库中的文件。

## Decision

### 决策 1：backup_records 表添加 storage_driver 字段

在 `backup_records` 表中添加 `storage_driver` 枚举字段，记录备份创建时使用的存储驱动（GITHUB / S3 / LOCAL）。

**下载/删除逻辑**：

1. 优先使用备份记录中存储的 `storage_driver` 来获取对应的驱动实例
2. 如果该驱动的配置不可用（比如环境变量和数据库都没有配置），则回退到当前配置的私有存储驱动
3. 维护一个驱动实例缓存，key 为驱动类型，避免重复创建

**不记录的信息**：

- 不记录完整的存储配置（仓库名、endpoint、Token 等），避免敏感信息冗余存储
- 不记录 storage_url，因为 URL 可以通过驱动 + fileKey 动态生成，记录 URL 反而会因为 CDN 切换、域名变更而过时

**优点**：

- 简单，只加一个枚举字段
- 能覆盖 90% 的场景（切换驱动后旧备份仍可操作）
- 不存储敏感配置，安全

**缺点**：

- 如果旧驱动的配置完全变了（比如换了 GitHub 仓库），还是会失败
- 解决方式：提供"重新绑定驱动配置"功能，或用迁移脚本把旧备份迁到新驱动

### 决策 2：Cron 配置 UI 对齐 GitHub Token 模式

给 `CRON_SECRET` 和 `CRON_JOB_API_KEY` 两个字段都加上：

1. "✓ 已配置"状态提示（绿色文字）
2. 小眼睛按钮切换明文/密文
3. placeholder 提示"留空则保持当前配置，输入新值则覆盖"

这是纯前端 UI 改进，没有架构决策，直接对齐现有模式即可。

### 决策 3：StorageDriver interface 添加 download() 方法

在 `StorageDriverInterface` 中添加 `download(fileKey: string): Promise<Buffer>` 方法。

**默认实现**（在基类或工厂函数中）：

```typescript
async download(fileKey: string): Promise<Buffer> {
  const url = this.getUrl(fileKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
```

**GitHub 驱动重写**：
使用 GitHub Contents API + Token 下载：

```
GET /repos/{owner}/{repo}/contents/{path}
Authorization: token {GITHUB_PRIVATE_TOKEN}
```

返回的 JSON 中 `content` 字段是 Base64 编码的文件内容，解码后得到 Buffer。

**关于 GitHub API 1MB 限制**：

- GitHub Contents API 单文件最大 1MB，超过需要用 Git Blob API（`GET /repos/{owner}/{repo}/git/blobs/{sha}`）
- 实现时先尝试 Contents API，如果返回 "too large" 错误，则自动切换到 Blob API
- 备份文件通常是 JSON，一般不会超过 1MB（除非文章特别多）
- 后续可优化：备份时压缩，或支持分卷备份

**关于 OAuth 鉴权**：

- 不使用 Better Auth 的 GitHub OAuth token 下载私有仓库文件，原因：
  1. OAuth token 可能过期，需要刷新
  2. 用户可能登录的是没有仓库权限的账号
  3. 备份下载应该是服务端行为，不应该依赖当前登录用户的权限
- 使用独立的 `GITHUB_PRIVATE_TOKEN`（Personal Access Token），权限最小化（只给 repo 权限）

**优点**：

- 最符合面向对象设计——"谁存储，谁负责读取"
- Token 只在服务端使用，不暴露给客户端
- 向后兼容：默认实现还是 `fetch(getUrl())`，只有 GitHub 驱动需要重写
- 未来 S3 驱动也可以重写为使用预签名 URL 或 SDK 下载，更安全

## Consequences

### 正向影响

1. **切换驱动后旧备份仍可操作**：用户可以自由切换私有存储驱动，旧备份不会变成"孤儿"
2. **UI 一致性**：Cron 配置和其他敏感字段的 UI 体验一致
3. **私有仓库安全下载**：备份文件可以安全地存储在 GitHub 私有仓库中，下载时不暴露 Token
4. **可扩展性**：download() 方法为未来其他驱动（S3 预签名 URL、FTP 等）的特殊下载逻辑预留了扩展点

### 负向影响

1. **数据库迁移**：需要给 backup_records 表添加 storage_driver 字段，旧数据需要设置默认值（比如当前配置的驱动，或 NULL 表示未知）
2. **驱动实例管理复杂度增加**：需要维护多个驱动实例的缓存，而不是单一实例
3. **GitHub API 调用限制**：下载私有仓库文件会消耗 GitHub API 速率限制（5000 次/小时 for authenticated），但备份下载频率很低，不会有问题

### 后续优化项

1. **备份文件压缩**：备份时 gzip 压缩，减少存储空间和下载时间
2. **分卷备份**：大备份自动分割成多个小文件，避免 GitHub API 1MB 限制
3. **备份完整性校验**：上传前计算 SHA256，下载后校验，确保文件完整
4. **审计日志 UI**：在后台备份管理页面展示审计日志（当前只记录到数据库，没有 UI）

## References

- ADR-0008: 存储架构公私分离
- GitHub Contents API: https://docs.github.com/en/rest/repos/contents
- GitHub Git Blob API: https://docs.github.com/en/rest/git/blobs
