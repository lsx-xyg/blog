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

import { getConfig } from "./get-config";
import { registry, type RegistryKey } from "./registry";

/* ---------------- 类型工具：把扁平键组装成嵌套类型 ---------------- */

/** 把 "github.owner" 这样的路径和值类型，组装成 { github: { owner: V } } */
type NestPath<P extends string, V> = P extends `${infer Head}.${infer Rest}`
  ? { [K in Head]: NestPath<Rest, V> }
  : { [K in P]: V };

/** 把多个交叉对象合并成一个（{ a: X } & { b: Y } → { a: X; b: Y }） */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/** 对 prefix 下所有 registry 键，组装成嵌套对象类型 */
export type GroupOf<P extends string> = UnionToIntersection<
  {
    [K in RegistryKey]: K extends `${P}.${infer Rest}`
      ? NestPath<Rest, (typeof registry)[K]["default"]>
      : never;
  }[RegistryKey]
>;

/* ---------------- 运行时实现 ---------------- */

/**
 * 按前缀读取一组配置，组装成嵌套对象。
 *
 * 语义：取所有以 `${prefix}.` 开头的 registry 键，去掉前缀后按点号还原嵌套。
 *
 * 例：prefix = "storage"
 *   storage.driver          → { driver: ... }
 *   storage.github.owner    → { github: { owner: ... } }
 *   storage.s3.accessKey    → { s3: { accessKey: ... } }
 *   storage.local.uploadDir → { local: { uploadDir: ... } }
 *
 * 注意：
 * - 返回类型由 GroupOf<P> 推导，调用方无需断言。
 * - 命中前缀的键并行读取，走 getConfig（含解密 / transform）。
 * - 若 registry 里没有匹配的键，返回空对象。
 * - 嵌套靠键名里的点号决定：registry 键的最后一段必须与目标字段名逐字一致。
 *
 * @param prefix 前缀（不含结尾的点号），如 "storage"
 * @returns 组装后的嵌套对象
 */
export async function getConfigGroup<P extends string>(
  prefix: P,
): Promise<GroupOf<P>> {
  const prefixDot = `${prefix}.`;

  const keys = (Object.keys(registry) as RegistryKey[]).filter((k) =>
    k.startsWith(prefixDot),
  );

  const entries = await Promise.all(
    keys.map(async (k) => {
      const path = k.slice(prefixDot.length);
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
function setNested(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (typeof next !== "object" || next === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]] = value;
}
