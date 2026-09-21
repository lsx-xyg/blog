/**
 * 旧备份数据迁移脚本（历史一次性脚本，已完成使命）
 *
 * 功能：将存储在公开存储（public storage）中的旧备份文件迁移到私有存储（private storage）
 *
 * 使用场景：
 * - 存储架构「公私分离」重构（ADR-0008）后，旧的备份文件可能还存储在公开仓库中
 * - 需要将这些敏感数据迁移到私有仓库，避免数据泄露
 *
 * ⚠️ 现状（2026-09-21）：存储已改为「档案池 + 通道绑定」（ADR-0015），
 * 后台不再有独立的公开/私有两套配置。脚本里的
 * `getPublicStorageDriver()` / `getPrivateStorageDriver()` 仍可用，但语义已变为
 * `getStorageDriver(UPLOAD)` / `getStorageDriver(BACKUP)`（即通道绑定的档案）。
 * 若档案池已播种，本脚本会按绑定档案而不是旧版 env 迁移——执行前请先确认绑定。
 *
 * 使用方法：
 *   npx tsx scripts/storage/migrate-backups-to-private.ts [--delete]
 *
 * 参数：
 *   --delete  迁移完成后从公开存储删除旧文件（默认不删除，只复制）
 *
 * 注意：
 * - 运行前请确保公开通道与备份通道都已绑定可用档案
 * - 建议先不带 --delete 参数运行，验证迁移结果后再删除旧文件
 * - 迁移过程中会更新数据库 backup_records 表中的 fileKey
 * - 本脚本假设公开存储可通过 HTTP 访问（如 GITHUB），LOCAL 驱动可能不适用
 */

import '@/lib/env/server/load';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { backupRecords } from '@/db/schema';
import { getPublicStorageDriver, getPrivateStorageDriver } from '@/lib/storage/server';
import { ENV_KEYS } from '@/lib/env/shared';
import { getEnv } from '@/lib/env/server';

type MigrationResult = {
  id: string;
  oldKey: string;
  newKey: string | null;
  status: 'success' | 'failed';
  error?: string;
};

async function main() {
  const shouldDelete = process.argv.slice(2).includes('--delete');

  console.log('========================================');
  console.log('  旧备份数据迁移脚本');
  console.log('========================================');
  console.log(`删除旧文件: ${shouldDelete ? '是' : '否（仅复制）'}`);
  console.log('');

  const databaseUrl = getEnv(ENV_KEYS.DATABASE_URL_UNPOOLED) ?? getEnv(ENV_KEYS.DATABASE_URL);
  if (!databaseUrl) {
    console.error(`❌ ${ENV_KEYS.DATABASE_URL_UNPOOLED} 和 ${ENV_KEYS.DATABASE_URL} 都未配置`);
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    // 1. 从数据库读取所有备份记录
    console.log('1. 从数据库读取备份记录...');
    const records = await db.select().from(backupRecords).orderBy(backupRecords.createdAt);
    console.log(`   找到 ${records.length} 条备份记录`);
    console.log('');

    if (records.length === 0) {
      console.log('没有需要迁移的备份记录，退出。');
      return;
    }

    // 2. 获取存储驱动实例
    console.log('2. 获取存储驱动实例...');
    const publicDriver = await getPublicStorageDriver();
    const privateDriver = await getPrivateStorageDriver();
    console.log(`   公开存储: ${publicDriver.name}`);
    console.log(`   私有存储: ${privateDriver.name}`);
    console.log('');

    // 3. 逐个迁移备份文件
    console.log('3. 开始迁移备份文件...');
    console.log('');

    const results: MigrationResult[] = [];

    for (const [i, record] of records.entries()) {
      const oldKey = record.fileKey;
      const progress = `[${i + 1}/${records.length}]`;

      console.log(`${progress} 处理备份: ${oldKey}`);

      try {
        // 3.1 从公开存储读取文件
        const publicUrl = publicDriver.getUrl(oldKey);
        console.log(`   从公开存储读取: ${publicUrl}`);

        const response = await fetch(publicUrl);
        if (!response.ok) {
          throw new Error(`读取失败: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`   文件大小: ${(buffer.length / 1024).toFixed(2)} KB`);

        // 3.2 上传到私有存储（保持相同的 key）
        console.log(`   上传到私有存储...`);
        const uploadResult = await privateDriver.upload(buffer, oldKey, 'application/json');
        const newKey = uploadResult.key;
        console.log(`   新 key: ${newKey}`);

        // 3.3 更新数据库记录（仅当 key 变了）
        if (newKey !== oldKey) {
          await db
            .update(backupRecords)
            .set({ fileKey: newKey })
            .where(eq(backupRecords.id, record.id));
          console.log(`   数据库记录已更新: ${oldKey} -> ${newKey}`);
        }

        // 3.4 可选：从公开存储删除旧文件
        // 仅当 key 变了才删，否则新文件就是旧文件本身，删了会导致数据库记录指向不存在的文件
        if (shouldDelete && newKey !== oldKey) {
          console.log(`   从公开存储删除旧文件...`);
          await publicDriver.delete(oldKey);
          console.log(`   旧文件已删除`);
        }

        results.push({
          id: record.id,
          oldKey,
          newKey,
          status: 'success',
        });
        console.log(`   ✓ 迁移成功`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ✗ 迁移失败: ${errorMessage}`);
        results.push({
          id: record.id,
          oldKey,
          newKey: null,
          status: 'failed',
          error: errorMessage,
        });
      }
      console.log('');
    }

    // 4. 输出迁移结果汇总
    console.log('========================================');
    console.log('  迁移结果汇总');
    console.log('========================================');
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    console.log(`总计: ${results.length}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failedCount}`);
    console.log('');

    if (failedCount > 0) {
      console.log('失败的备份:');
      results
        .filter((r) => r.status === 'failed')
        .forEach((r) => {
          console.log(`  - ${r.oldKey} (id: ${r.id}): ${r.error}`);
        });
      console.log('');
    }

    if (!shouldDelete && successCount > 0) {
      console.log('提示：本次运行未删除旧文件。验证迁移结果后，可以运行以下命令删除旧文件：');
      console.log('  npx tsx scripts/migrate-backups-to-private.ts --delete');
      console.log('');
    }

    console.log('迁移完成！');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('迁移脚本执行失败：', error);
  process.exit(1);
});
