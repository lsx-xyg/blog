/**
 * 层 2：getConfig + getConfigGroup
 *
 * - getConfig：单键读取，唯一优先级合并点（env > DB > default）+ 解密 + transform
 * - getConfigGroup：按前缀取一组键，组装成嵌套对象
 *
 * 全库只有这一处做优先级合并；门面函数、storage 都不得重复实现。
 * 缓存层可在本函数预留扩展点（本次不实现）。
 */

import { getSetting } from './store';
import { registry, type RegistryKey, type ConfigDef } from '../shared/registry';

/**
 * 读取单个配置，按 env > DB > default 合并，并对敏感字段解密。
 *
 * 执行顺序：
 * 1. 查 registry 声明
 * 2. 从 DB 读取原始值
 * 3. 若为敏感字段且有值，动态 import 解密工具并解密
 * 4. 读环境变量
 * 5. 合并：env > db > default
 * 6. 有 transform 则应用，否则原样返回
 *
 * @param name registry 中的语义化键名
 * @returns 合并后的配置值（类型由该条目的 default 推断）
 */
export async function getConfig<K extends RegistryKey>(
  name: K,
): Promise<(typeof registry)[K]['default']> {
  const def: ConfigDef<any> = registry[name];

  const dbVal = await getSetting<string | boolean | number>(def.key);

  let dbResolved: string | boolean | number | null = dbVal;
  if (def.secret && typeof dbVal === 'string' && dbVal) {
    const { decryptIfAvailable } = await import('@/lib/crypto/server');
    dbResolved = decryptIfAvailable(dbVal);
  }

  const envVal = def.env ? process.env[def.env] : undefined;

  // 合并：env > DB > default。
  // 注意 DB 值可能是 JSONB 反序列化出的布尔 false / 0 / 空串等 falsy 值，
  // 必须用 null 判断而不能用 || 兜底，否则 falsy 配置会静默落回默认值。
  const raw =
    envVal ?? (dbResolved !== null && dbResolved !== undefined ? dbResolved : def.default);

  return def.transform ? def.transform(String(raw)) : raw;
}
