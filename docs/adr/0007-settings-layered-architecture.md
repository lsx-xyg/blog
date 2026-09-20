# ADR-0007: Settings 分层架构与类型集中管理

- Status: **Accepted**
- Date: 2026-09-14

## Context

原配置模块存在大量重复逻辑、扩展繁琐、类型散乱问题。旧版 `lib/settings.ts` 每个配置项都需要手写 `env || db || default` 优先级合并、手动解密、手动类型处理，新增一个配置需要修改多处代码。同时 `lib/storage/config.ts` 存在同款重复配置解析逻辑，维护成本极高。

项目类型定义散落混乱：`StorageDriverType` 多文件重复定义，图库、定时任务等业务类型混杂在数据访问层文件中，容易产生循环依赖、类型不一致、代码难以治理等问题。

## Decision

对 Settings 配置层进行架构重构，统一解析流程、收拢类型、规范化扩展机制：

- **四层分层架构**：将 settings 拆解为「数据库层、注册声明层、解析核心层、门面接口层」，固定全局配置优先级 **env > DB > default**，所有合并、解密、转换逻辑唯一收口在 `getConfig`
- **配置声明中心化**：所有配置统一在 registry 声明，新增配置仅需一行配置定义，无需重复编写解析逻辑
- **新增类型安全分组配置**：提供 `getConfigGroup`，支持按前缀聚合扁平配置为嵌套对象，TS 自动推导完整类型，无需业务层手动断言
- **模块收敛与命名规整**：将 storage 配置完全收归 settings 模块，废弃独立 config 文件；统一接口命名风格，移除无效废弃函数
- **类型集中治理**：通用业务类型统一迁移至 `lib/types/`，配置私有类型收口至 settings 内部，使用 `as const` 常量类型替代 enum，兼顾类型安全与运行时性能

## Core Implementation

### 1. 存储驱动工厂 + 单例缓存

位置：`lib/storage/index.ts`

工厂按 `driverType` 创建实例，`cached` 按类型缓存，避免重复 `new`。
driver 的配置来自 `getStorageSettings()`（内部走 `getConfigGroup("storage")`），
实例内部不再查 DB，`getUrl` 等同步接口不受影响。

```ts
import { type StorageDriverInterface, StorageDriverType } from '@/lib/types/storage';
import { getStorageSettings } from '@/lib/settings';
import { LocalStorageDriver, GithubStorageDriver, S3StorageDriver } from '@/lib/storage/drivers';

export * from '@/lib/types/storage';
export * from '@/lib/storage/drivers';
export * from '@/lib/storage/utils';

/** 缓存驱动实例（按 driver 类型缓存，避免重复创建） */
const cached = new Map<StorageDriverType, StorageDriverInterface>();

/**
 * 获取当前配置的存储驱动实例（异步，配置来自 DB / env）。
 *
 * 单例：同一 driverType 只创建一次。
 * 配置优先级：env > DB > default（由 getStorageSettings / getConfig 统一处理）。
 */
export async function getStorageDriverInstance(): Promise<StorageDriverInterface> {
  const settings = await getStorageSettings();
  const driverType = settings.driver;

  let instance = cached.get(driverType);
  if (instance) return instance;

  switch (driverType) {
    case StorageDriverType.GITHUB:
      instance = new GithubStorageDriver(settings.github);
      break;
    case StorageDriverType.S3:
      instance = new S3StorageDriver(settings.s3);
      break;
    case StorageDriverType.LOCAL:
    default:
      instance = new LocalStorageDriver(settings.local);
      break;
  }

  cached.set(driverType, instance);
  return instance;
}

/** 重置驱动缓存（配置变更后调用，使新配置生效） */
export function resetStorageDriver(): void {
  cached.clear();
}
```

**要点**

- switch 里用 StorageDriverType.GITHUB 而不是裸字符串 "GITHUB"，改值只改常量
- 变量名用 settings（小写），避免和类型 StorageSettings 同名混淆
- 配置不在 driver 内部查，一次查全后注入构造函数——保证 getUrl 同步、driver 可测试、职责单一

### 2. 常量定义：as const 对象 + 同名 type + 派生数组

位置：`lib/types/storage.ts`

```ts
export const StorageDriverType = {
  LOCAL: 'LOCAL',
  GITHUB: 'GITHUB',
  S3: 'S3',
} as const;

export type StorageDriverType = (typeof StorageDriverType)[keyof typeof StorageDriverType];

/** 所有驱动类型值（数组，供 .map / .includes 用） */
export const STORAGE_DRIVER_VALUES = Object.values(StorageDriverType) as StorageDriverType[];
```

**要点**

- 值和类型同名，TS 两套命名空间，不冲突，按位置区分
- as const 让值保持字面量类型（"LOCAL" 而非 string）
- keyof typeof 不能省：keyof 取键名联合，(typeof X)[keyof typeof X] 取值联合
- Object.values 把对象派生成数组，供 .map / .includes；as StorageDriverType[] 断言因为 Object.values 可能推断为 string[]
- 不用 enum：enum 生成运行时对象、tree-shaking 差、不接受裸字符串 "LOCAL"

### 3. getConfigGroup：按前缀聚合并自动推导类型

位置：`lib/settings/get-config-group.ts`

把扁平键（如 `storage.github.owner`）按前缀聚合为嵌套对象，**返回类型从 registry 自动推导**，调用方无需 `as` 断言。

```ts
/**
 * 层 2 扩展：getConfigGroup —— 按前缀取一组键，组装成嵌套对象。
 *
 * 类型安全版：通过 GroupOf<P> 从 registry 自动推导返回类型，
 * 调用方无需手动断言，例如：
 *   const storage = await getConfigGroup("storage");
 *   storage 的类型自动是 { driver, github: {...}, s3: {...}, local: {...} }
 *
 * 若 registry 的键结构与目标类型（如 StorageSettings）不一致，
 * 调用方赋值时会编译报错，起到「registry ↔ 类型」同步检查的作用。
 */

import { getConfig } from './get-config';
import { registry, type RegistryKey } from './registry';

/* ---------------- 类型工具：把扁平键组装成嵌套类型 ---------------- */

/** 把 "github.owner" 这样的路径和值类型，组装成 { github: { owner: V } } */
type NestPath<P extends string, V> = P extends `${infer Head}.${infer Rest}`
  ? { [K in Head]: NestPath<Rest, V> }
  : { [K in P]: V };

/** 把多个交叉对象合并成一个（{ a: X } & { b: Y } → { a: X; b: Y }）
 *  原理：函数参数逆变位置推断 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/** 对 prefix 下所有 registry 键，组装成嵌套对象类型 */
export type GroupOf<P extends string> = UnionToIntersection<
  {
    [K in RegistryKey]: K extends `${P}.${infer Rest}`
      ? NestPath<Rest, (typeof registry)[K]['default']>
      : never;
  }[RegistryKey]
>;

export async function getConfigGroup<P extends string>(prefix: P): Promise<GroupOf<P>> {
  const prefixDot = `${prefix}.`;

  const keys = (Object.keys(registry) as RegistryKey[]).filter((k) => k.startsWith(prefixDot));

  const entries = await Promise.all(
    keys.map(async (k) => {
      const path = k.slice(prefixDot.length); // "storage.github.owner" → "github.owner"
      const value = await getConfig(k);
      return [path, value] as const;
    }),
  );

  const result: Record<string, unknown> = {};
  for (const [path, value] of entries) {
    setNested(result, path, value);
  }
  return result as GroupOf<P>;
}

/** 把 "github.owner" 这样的点号路径塞进嵌套对象 */
function setNested(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (typeof next !== 'object' || next === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]] = value;
}
```

**类型工具拆解**

| 工具                     | 作用                           | 例子                                                               |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------ |
| `NestPath<P, V>`         | 把点号路径展开为嵌套类型       | `"github.owner"` + `string` → `{ github: { owner: string } }`      |
| `UnionToIntersection<U>` | 联合变交叉                     | `{a} \| {b}` → `{a} & {b}`                                         |
| `GroupOf<P>`             | 对 prefix 下所有键组装完整类型 | `"storage"` → `{ driver, github: {...}, s3: {...}, local: {...} }` |

**执行流程**

```
GroupOf<"storage">
  ├─ { [K in RegistryKey]: K 匹配 "storage." ? NestPath<...> : never }
  │     → { "storage.driver": {driver}; "storage.github.owner": {github:{owner}}; ... ; "site.name": never }
  ├─ [RegistryKey] 索引访问 → 取所有值，得联合
  │     → never | {driver} | {github:{owner}} | ...  → never 消失
  └─ UnionToIntersection → 交叉合并
        → { driver } & { github:{owner} } & ... → { driver, github:{owner,...}, s3:{...}, local:{...} }
```

**约束（重要）**

`getConfigGroup` **只适用于**：

- 返回类型 = registry 某前缀的**完整映射**（字段名和键路径**逐字一致**）
- **无后处理**（如 `footer.copyright` 为空生成年份，不能用）
- **无派生字段**（如 `cron.secret` 键名 ≠ `cronSecret` 字段名，不能用）

当前唯一用例：`getStorageSettings`。

**核心代码位置速查**

| 主题                                              | 文件                               |
| ------------------------------------------------- | ---------------------------------- |
| 四层结构（store / registry / get-config / index） | `lib/settings/*`                   |
| getConfigGroup + 类型体操                         | `lib/settings/get-config-group.ts` |
| 常量定义 + 派生数组                               | `lib/types/storage.ts`             |
| 存储驱动工厂 + 单例                               | `lib/storage/index.ts`             |
| 配置声明表                                        | `lib/settings/registry.ts`         |

## Consequences

**收益：**

- 彻底消除配置解析重复代码，全局逻辑唯一统一，减少隐性 Bug
- 新增配置成本极低，仅需声明默认值、环境变量、转换规则，无需重复业务代码
- 全链路类型自动推导，杜绝手动 as 断言带来的类型丢失风险
- 分层职责清晰、解耦彻底，后续扩展存储驱动、新增配置分组更加规范
- 对外门面函数完全兼容旧用法，业务层零改动、平滑升级

**约束：**

- `getConfigGroup` 仅适用于无前处理、无后处理、字段完全映射的纯前缀配置场景
- 当前分组解析不支持数组下标路径配置，业务配置需规避数组式 key
- 所有敏感配置解密逻辑统一收口，禁止业务层自行解密
- 新增存储驱动需同步更新类型、注册表、驱动匹配分支，保证闭环一致

## Commit Message

```Plain Text
refactor(settings): 重构配置层为 registry + getConfig + 门面函数三层架构
- lib/settings 拆为 store / registry / get-config / types / index
- getConfig 成为唯一优先级合并点（env > DB > default）+ 解密 + transform
- 新增 getConfigGroup，按前缀聚合配置为嵌套对象（类型自动推导）
- storage 配置收进 settings，删除 lib/storage/config.ts
- 类型集中到 lib/types/，StorageDriverType 收口到 lib/types/storage
- 改名：getStorageConfig → getStorageSettings，getCronConfig → getCronSettings
- 移除 getStorageSecrets（无引用）
- 同时更新 lib 目录下其他文件位置规范，保持一致
```

## Related Files

`lib/settings/*`、`lib/storage/*`、`lib/types/*`
