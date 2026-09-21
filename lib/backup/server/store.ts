/**
 * 备份存储驱动解析（Backup Storage Driver 语义）
 *
 * 职责：根据备份记录选驱动——优先按记录创建时的**平台**在档案池里找该平台的档案
 * （切换通道绑定后旧备份仍可操作），找不到时回退到备份通道
 * （`storage.binding.backup`）当前绑定的驱动，即 `getStorageDriver(BACKUP)`。
 */
import { getPrivateStorageDriver, getPrivateStorageDriverByType } from '@/lib/storage/server';
import type { StorageDriverInterface, StorageDriverType } from '@/lib/types/storage';

/**
 * 解析备份记录应使用的存储驱动
 *
 * @param record 备份记录（至少含 storageDriver 字段）
 * @returns 可用的驱动实例（优先记录驱动，回退当前配置）
 */
export async function resolveBackupStorageDriver(record: {
  storageDriver: StorageDriverType | null;
}): Promise<StorageDriverInterface> {
  if (record.storageDriver) {
    const driverByType = await getPrivateStorageDriverByType(record.storageDriver);
    if (driverByType) {
      return driverByType;
    }
    console.warn(
      `[backup] 记录的存储驱动 ${record.storageDriver} 配置不可用，回退到当前配置的驱动`,
    );
  }
  return getPrivateStorageDriver();
}
