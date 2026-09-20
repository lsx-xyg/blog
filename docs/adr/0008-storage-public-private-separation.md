# ADR-0008: 存储架构公私分离（Public/Private Storage Separation）

- Status: **Accepted**
- Date: 2026-09-15

## Context

原存储架构使用单一 `StorageDriver` 实例，所有文件（公开图片和私有备份）都存储在同一个仓库/bucket/目录中。这导致以下问题：

1. **安全风险**：数据库备份包含敏感信息（用户数据、OAuth Token 等），存储在公开 GitHub 仓库中会被 GitHub Secret Scanning 拦截（409 错误），且存在数据泄露风险。
2. **权限混淆**：公开资源需要公开访问（CDN 加速），私有资源需要严格控制访问权限，单一实例无法同时满足两种需求。
3. **配置混乱**：公开存储和私有存储的配置（仓库名、bucket、目录、Token）混在一起，难以管理和切换。
4. **"不要一石三鸟"原则**：用户明确要求不在一个免费平台放所有东西，公开资源和私有数据应该物理隔离。

## Decision

对存储架构进行公私分离重构，采用**双实例架构**：

- **Public Storage（公开存储）**：用于图片、视频等公开可访问的资源
  - GitHub：公开仓库 `public`（原 `images` 改名）
  - S3：公开 bucket
  - Local：`public/uploads/` 目录（可通过 HTTP 访问）
  - 访问方式：jsDelivr CDN / 公开 URL

- **Private Storage（私有存储）**：用于数据库备份等敏感数据
  - GitHub：私有仓库 `backups`（新建）
  - S3：私有 bucket
  - Local：`private/storage/` 目录（不暴露到 Web）
  - 访问方式：仅后台 API 可下载，不提供公开 URL

### 核心设计决策

1. **Interface 不修改**：`StorageDriverInterface` 保持不变（upload/delete/getUrl），双实例共用同一套接口
2. **双实例工厂**：`getPublicStorageDriver()` 和 `getPrivateStorageDriver()` 两个独立工厂函数，各自维护缓存
3. **配置分组**：公开存储用 `storage.*` 前缀，私有存储用 `storagePrivate.*` 前缀，通过 `getConfigGroup` 统一获取
4. **目录配置**：所有驱动支持 `directory` 子目录配置，可在仓库/bucket/目录内进一步隔离
5. **向后兼容**：保留 `getStorageDriverInstance()` 作为 `getPublicStorageDriver()` 的别名，旧代码无需修改

### 环境变量命名

**公开存储（保留原有命名）：**
- `STORAGE_DRIVER` / `GITHUB_STORAGE_OWNER` / `GITHUB_STORAGE_REPO` / `GITHUB_STORAGE_BRANCH` / `GITHUB_STORAGE_CDN_BASE` / `GITHUB_STORAGE_DIRECTORY` / `GITHUB_STORAGE_TOKEN`
- `S3_ENDPOINT` / `S3_BUCKET` / `S3_REGION` / `S3_DIRECTORY` / `S3_ACCESS_KEY` / `S3_SECRET_KEY`
- `LOCAL_UPLOAD_DIR` / `LOCAL_STORAGE_DIRECTORY`

**私有存储（新增）：**
- `STORAGE_PRIVATE_DRIVER` / `GITHUB_PRIVATE_OWNER` / `GITHUB_PRIVATE_REPO` / `GITHUB_PRIVATE_BRANCH` / `GITHUB_PRIVATE_CDN_BASE` / `GITHUB_PRIVATE_DIRECTORY` / `GITHUB_PRIVATE_TOKEN`
- `S3_PRIVATE_ENDPOINT` / `S3_PRIVATE_BUCKET` / `S3_PRIVATE_REGION` / `S3_PRIVATE_DIRECTORY` / `S3_PRIVATE_ACCESS_KEY` / `S3_PRIVATE_SECRET_KEY`
- `LOCAL_PRIVATE_DIR` / `LOCAL_PRIVATE_SUBDIRECTORY`

### GitHub 仓库变更

1. **原 `images` 仓库改名为 `public`**：公开资源仓库，用于文章/相册图片
2. **新建 `backups` 私有仓库**：私有仓库，用于数据库备份
3. **Token 权限**：公开存储和私有存储可使用不同的 GitHub Token，权限最小化

## Core Implementation

### 1. 双实例存储驱动工厂

位置：`lib/storage/index.ts`

```ts
import { type StorageDriverInterface, StorageDriverType } from "@/lib/types/storage";
import { getStorageSettings, getPrivateStorageSettings } from "@/lib/settings";
import { LocalStorageDriver, GithubStorageDriver, S3StorageDriver } from "@/lib/storage/drivers";

/** 公开存储缓存 */
const publicCached = new Map<StorageDriverType, StorageDriverInterface>();
/** 私有存储缓存 */
const privateCached = new Map<StorageDriverType, StorageDriverInterface>();

/** 根据配置创建驱动实例 */
function createDriverInstance(
  driverType: StorageDriverType,
  settings: { github: any; s3: any; local: any }
): StorageDriverInterface {
  switch (driverType) {
    case StorageDriverType.GITHUB:
      return new GithubStorageDriver(settings.github);
    case StorageDriverType.S3:
      return new S3StorageDriver(settings.s3);
    case StorageDriverType.LOCAL:
    default:
      return new LocalStorageDriver(settings.local);
  }
}

/** 获取公开存储驱动（图片/视频等公开资源） */
export async function getPublicStorageDriver(): Promise<StorageDriverInterface> {
  const settings = await getStorageSettings();
  const driverType = settings.driver;
  let instance = publicCached.get(driverType);
  if (instance) return instance;
  instance = createDriverInstance(driverType, settings);
  publicCached.set(driverType, instance);
  return instance;
}

/** 获取私有存储驱动（备份等敏感数据） */
export async function getPrivateStorageDriver(): Promise<StorageDriverInterface> {
  const settings = await getPrivateStorageSettings();
  const driverType = settings.driver;
  let instance = privateCached.get(driverType);
  if (instance) return instance;
  instance = createDriverInstance(driverType, settings);
  privateCached.set(driverType, instance);
  return instance;
}

/** 兼容旧代码：等同于公开存储 */
export async function getStorageDriverInstance(): Promise<StorageDriverInterface> {
  return getPublicStorageDriver();
}

/** 重置所有驱动缓存 */
export function resetStorageDriver(): void {
  publicCached.clear();
  privateCached.clear();
}
```

### 2. 目录配置支持

所有驱动（GitHub/S3/Local）新增 `directory` 配置项，用于在仓库/bucket/目录内进一步隔离文件。

位置：`lib/storage/drivers/github-driver.ts`

```ts
/** 构建完整路径（包含子目录） */
private buildPath(key: string): string {
  return this.directory ? `${this.directory}/${key}` : key;
}

/** 构建 jsDelivr CDN URL */
getUrl(key: string): string {
  const fullPath = this.buildPath(key);
  return `${this.cdnBase}/${this.owner}/${this.repo}@${this.branch}/${fullPath}`;
}
```

### 3. 备份功能使用私有存储

位置：`lib/backup/index.ts`

```ts
import { getPrivateStorageDriver } from "@/lib/storage";

// 创建备份并上传到私有存储
export async function createBackup(...) {
  // ... 导出备份数据 ...
  const driver = await getPrivateStorageDriver(); // 使用私有存储
  const uploadResult = await driver.upload(buffer, filename, "application/json");
  // ...
}
```

### 4. 图片上传使用公开存储

位置：`app/api/upload/route.ts`、`app/api/admin/media/*`

```ts
import { getPublicStorageDriver } from "@/lib/storage";

const driver = await getPublicStorageDriver(); // 使用公开存储
const result = await driver.upload(buffer, file.name, file.type);
```

### 5. 注册表配置项

位置：`lib/settings/registry.ts`

- 公开存储：`storage.driver`、`storage.github.*`、`storage.s3.*`、`storage.local.*`（新增 directory 字段）
- 私有存储：`storagePrivate.driver`、`storagePrivate.github.*`、`storagePrivate.s3.*`、`storagePrivate.local.*`（完整新增）

### 6. 后端 API 支持

位置：`app/api/admin/settings/route.ts`

- GET：返回 `storage` 和 `privateStorage` 两组配置（敏感信息不返回明文）
- PUT：支持保存 `storage` 和 `privateStorage` 两组配置（敏感信息加密存储）

## Consequences

**收益：**

- **安全隔离**：备份等敏感数据存储在私有仓库/bucket，不会被公开访问，避免 GitHub Secret Scanning 拦截
- **权限最小化**：公开存储和私有存储可使用不同的 Token/密钥，权限隔离
- **配置清晰**：两组配置独立管理，可分别切换驱动、仓库、目录
- **物理隔离**：符合用户"不要一石三鸟"的原则，公开资源和私有数据不在同一平台
- **向后兼容**：保留旧接口别名，业务层代码零改动
- **灵活扩展**：后续可独立扩展公开/私有存储的功能（如公开存储加 CDN、私有存储加加密）

**约束：**

- 双实例意味着需要维护两组配置，环境变量数量增加
- 本地私有存储目录 `private/storage/` 不暴露到 Web，只能通过后台 API 下载
- 已上传到公开仓库的旧备份数据需要手动迁移或删除（本次不做自动迁移）
- 后台设置页面的私有存储 UI 待完善（当前已添加切换标签，详细配置表单后续优化）
- 新增存储驱动需同时更新公开和私有两组配置项

**后续优化项（已记录为 Issue）：**

1. 后台设置页面完善私有存储的详细配置表单
2. 旧备份数据从公开仓库迁移到私有仓库的脚本
3. 私有存储文件的加密存储（除了仓库私有外，文件内容也可加密）
4. 私有存储的访问日志和审计

## Commit Message

```Plain Text
feat(storage): 存储架构公私分离重构
- 双实例架构：getPublicStorageDriver() + getPrivateStorageDriver()
- 所有驱动支持 directory 子目录配置
- 备份功能使用私有存储，图片上传使用公开存储
- GitHub 公开仓库 images 改名为 public，新建私有仓库 backups
- 注册表新增 storagePrivate.* 完整配置项
- 后端设置 API 支持 privateStorage 读写
- 后台设置页面添加公开/私有存储切换标签
- 创建 CONTEXT.md 共享语言/术语表
```

## Related Files

- `lib/storage/index.ts` - 双实例工厂
- `lib/storage/drivers/github-driver.ts` - GitHub 驱动（目录支持）
- `lib/storage/drivers/s3-driver.ts` - S3 驱动（目录支持）
- `lib/storage/drivers/local-driver.ts` - Local 驱动（目录支持）
- `lib/settings/registry.ts` - 配置注册表（新增私有存储配置）
- `lib/settings/index.ts` - 设置访问层（新增 getPrivateStorageSettings）
- `lib/backup/index.ts` - 备份功能（使用私有存储）
- `app/api/upload/route.ts` - 图片上传（使用公开存储）
- `app/api/admin/media/*` - 媒体库 API（使用公开存储）
- `app/api/admin/settings/route.ts` - 设置 API（支持私有存储读写）
- `components/manage-settings.tsx` - 后台设置页面（公开/私有切换标签）
- `CONTEXT.md` - 共享语言/术语表
- `lib/types/settings.ts` - 配置类型定义（新增 directory 字段）
