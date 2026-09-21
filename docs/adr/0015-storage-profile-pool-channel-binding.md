# ADR-0015: 存储档案池 + 通道绑定（取代公私双实例）

- Status: **Accepted**（取代 [ADR-0008](./0008-storage-public-private-separation.md)）
- Date: 2026-09-21

## Context

ADR-0008 把存储拆成「公开 / 私有」两套实例：`getPublicStorageDriver()` 与 `getPrivateStorageDriver()`，
各自读一组固定配置（`storage.*` / `storagePrivate.*`）。这套模型解决了「备份不能放公开仓库」的核心问题，
但随着使用推进暴露了新的限制：

1. **配置维度写死为两个**：想让「文章图片走 GitHub、相册走 R2」（R2 容量大、流量便宜）时无处安放——
   公开组只能有一份配置，两处用途抢同一个实例。
2. **驱动组合受限**：想「备份同时落 WebDAV 和本地」也做不到，私有组同样只有一个槽位。
3. **新增驱动的成本高**：每加一个驱动（如 WebDAV）都要在公开、私有两组配置里各补一遍，
   配置项数量呈「驱动 × 2」膨胀。
4. **配置实体没有身份**：同一份「R2 配置」被多处复用时只能复制粘贴，改一处忘一处；
   也无法对某一份配置单独做连通性测试。

## Decision

把存储配置从「固定两组」改为**具名的档案池 + 按用途绑定的通道**：

- **Storage Profile（档案）**：`storage_profiles` 表的一行 = 一份完整命名的存储配置。
  - `name` 唯一，**用平台名**（`github` / `r2` / `webdav` / `local`），不按用途命名——
    同一份平台配置可以被多个通道复用（这也是档案池的价值）。
  - `driver` ∈ `LOCAL | GITHUB | S3 | WEBDAV`。
  - `config` jsonb 存该驱动的字段，敏感字段（token / secretKey / password）走 AES-256-GCM 加密。
- **Storage Channel（通道）**：存储的**用途**维度，注册表在 `lib/storage/shared/channels.ts`（扩展点文件）。

  | 通道      | 用途       | 可见性  | 对应 media.type |
  | --------- | ---------- | ------- | --------------- |
  | `upload`  | 文章图片   | public  | ARTICLE         |
  | `gallery` | 相册图片   | public  | GALLERY         |
  | `backup`  | 数据库备份 | private | —               |

- **Binding（绑定）**：通道 → 档案名的映射存 settings 表的 `storage.binding.{channel}`，
  env `STORAGE_BINDING_*` 可覆盖。空值 = 未绑定。
- **可见性约束**：档案的可见性由驱动能力决定（`STORAGE_DRIVER_META`），public 通道只能绑
  能给出公网 URL 的档案（WebDAV 无直链 → 只能绑 private 通道；S3 必须配 `publicBase`）。
  校验是**服务端**强制的，前端下拉过滤只是提前提示。
- **历史文件按平台反查**：`media.storage_driver` / `backup_records.storage_driver` 记录入库时的平台，
  读取/删除时按平台在档案池里找对应档案。**切换绑定只影响新上传**，已有文件永久可用。

### 核心实现

#### 1. 唯一取驱动入口

位置：`lib/storage/server/factory.ts`

```ts
/** 按通道（用途）获取存储驱动 —— 推荐入口 */
export async function getStorageDriver(channel: StorageChannel): Promise<StorageDriverInterface> {
  await ensureStorageProfilesSeeded();
  const bindings = await getChannelBindings();
  const bindingName = bindings[channel];
  if (bindingName) {
    const profile = (await listProfilesFull()).find((p) => p.name === bindingName);
    if (profile) return cached(profile); // 实例按档案名缓存
  }
  // 未绑定 / 绑定失效：public 通道回退旧公开配置，private 回退旧私有配置
  return channel === StorageChannel.BACKUP ? legacyPrivateDriver() : legacyPublicDriver();
}

/** 按平台反查档案（/m 路由与旧备份记录用） */
export async function getStorageDriverForPlatform(
  driverType: StorageDriverType,
  prefer: 'public' | 'private' = 'public',
): Promise<StorageDriverInterface | null> {
  /* 优先绑到对应可见性通道的档案 */
}
```

`getPublicStorageDriver()` / `getPrivateStorageDriver()` 保留为兼容别名，
语义分别退化为 `getStorageDriver(UPLOAD)` / `getStorageDriver(BACKUP)`。

#### 2. 驱动契约（重要约束）

- **`upload()` 不得调用 `getUrl()`**：私有档案（WebDAV、未配 `publicBase` 的 S3）没有公开 URL，
  `getUrl` 按设计会抛错。若在 upload 内部调用，会出现「文件已经写进远端，却被判上传失败，
  同时跳过清理步骤留下孤儿文件」的假失败（该 bug 已修，回归测试见 `private-url.test.ts`）。
  私有档案的 `upload` 返回 `url: ''`，读内容一律走 `download()`。
- `download()` 对所有驱动可用：GitHub 私有仓库走 Contents API + Token，其余默认 `fetch(getUrl())`。
- `getUrl()` 只对**公开可见性**的档案有意义；调用方需自行保证或捕获异常。

#### 3. 图片对外地址统一为站内路由

位置：`app/m/[...key]/route.ts`

`media.url` 与正文/封面中的图片地址固化为 `/m/{storageKey}`，路由按平台反查档案 → 拼真实 URL →
**流式代理**图片字节（失败时回退 302）。细节与「为什么不能用 302」见
CONTEXT.md 的 Media Route 词条。

#### 4. 后台与 API

- 页面：`/{adminSlug}/storage`（独立页，不挂在「站点设置」下，保存与设置页互不干扰）
- API：`GET/POST /api/admin/storage/profiles`、`PUT /api/admin/storage/bindings`、
  `POST /api/admin/storage/test`（upload → download 读回比对 → delete 往返测试，删除写 finally）

#### 5. 升级兼容（播种）

`ensureStorageProfilesSeeded()`（`lib/storage/server/profiles.ts`，幂等）在首次使用时把旧版
`storage.*` / `storagePrivate.*` 配置播种成 `github` / `github-backup` 两个档案并建立通道绑定。
旧配置组保留为**回退路径**：档案池为空或通道未绑定时仍可用，环境变量优先级不变（env > DB > default）。

## Consequences

**收益：**

- **用途维度的自由组合**：文章图 / 相册 / 备份各自绑档案，可以「GitHub 放文章图、R2 放相册、
  WebDAV 放备份」；同一份档案也能被多个通道复用（配置只维护一份）。
- **配置有身份**：档案可命名、可单独测试连通性、可单独删除；删除时校验是否仍被通道绑定。
- **扩展成本从「驱动 × 2 组」降到「加一行」**：加新用途只改 `channels.ts`（枚举 + 元数据），
  factory / API / UI 自动跟随。
- **历史文件与配置解耦**：切换绑定不影响已有图片与备份（按入库平台反查）。
- **可见性约束集中**：私有驱动误绑公开通道会在服务端被拒绝，而不是上传时才炸。

**约束与代价：**

- 档案实例按**档案名**缓存，配置变更后必须调用 `resetStorageDriver()` 清缓存（设置保存接口已内置）。
- 旧版 `storage.*` / `storagePrivate.*` 两组配置**不能立刻删**：它们是播种来源与回退路径，
  也是旧备份记录按平台反查的最后兜底。后台已不再直接编辑它们。
- `storage.webdav.*` 归档在旧版「公开组」前缀下，但 WebDAV 驱动仅允许绑定 private 通道——
  命名上略显拧巴，属于保留旧键名的代价。
- 档案池不做「同一档案多版本」，`config` 直接整份覆盖写入。

**后续可做：**

1. 档案支持「测试并预览一张真实图片」的可视化验证（当前只测往返读写）。
2. 档案级别的用量/大小统计，配合备份保留策略做容量提醒。
3. 把旧版 `storage.*` / `storagePrivate.*` 在若干个版本后彻底下线（需要先确认所有实例都已播种）。

## Commit Message

```Plain Text
feat(storage): 存储改为档案池 + 通道绑定，新增 S3(R2)/WebDAV 驱动

- 新增 storage_profiles 表（档案池）与 storage.binding.* 通道绑定
- 新增 StorageChannel 扩展点注册表（upload / gallery / backup）
- 新增 WebDAV 驱动；S3 驱动补齐实现与 publicBase 公开域名
- getStorageDriver(channel) 成为唯一取驱动入口，旧配置降级为回退路径
- 图片对外统一走站内路由 /m/{key}，按入库平台反查档案
- 后台存储设置拆为独立页 /{adminSlug}/storage
- 取代 ADR-0008 的公私双实例模型
```

## Related Files

- `lib/storage/shared/channels.ts` — 通道注册表（扩展点）
- `lib/storage/server/profiles.ts` — 档案池读写 / 播种 / 删除校验
- `lib/storage/server/factory.ts` — `getStorageDriver(channel)` / 平台反查 / 缓存与重置
- `lib/storage/server/drivers/` — local / github / s3 / webdav 四个驱动
- `lib/media/server/platform.ts` — 按 storageKey 反查入库平台
- `app/m/[...key]/route.ts` — 站内图片代理
- `app/api/admin/storage/{profiles,bindings,test}/route.ts` — 档案 CRUD / 绑定 / 连通性测试
- `components/shared/storage-profiles-manager.tsx` + `components/manage/manage-storage.tsx` — 后台 UI
- `lib/backup/server/store.ts` — 备份按平台解析驱动
- `docs/adr/0008-storage-public-private-separation.md` — 被本 ADR 取代
- `CONTEXT.md` — 存储领域词条（Storage Profile / Storage Channel / Storage Binding / Media Route）
