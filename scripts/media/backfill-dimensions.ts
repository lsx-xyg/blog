/**
 * 回填历史图片的原始宽高（media.width / media.height）
 *
 * 背景：宽高探测（lib/media/server/probe-dimensions.ts）是新加的，之前上传的
 * 图片这两列都是 NULL。相册瀑布流用 next/image 的 intrinsic 模式渲染时依赖
 * 原始宽高（保证无布局抖动的自然高度），缺失时会退回 4:3 兜底比例。
 *
 * 本脚本扫描 width/height 为空的 media 记录，按当前存储配置取回图片字节并用
 * sharp 探测尺寸后写库。图片走的是公开 CDN 地址，不需要管理员会话。
 *
 * 取值方式：media.url 现在存的是站内路由（/m/{key}，非 http），所以脚本优先用
 * storageKey 拼真实地址（`getPublicStorageDriver().getUrl()`）。
 *
 * ⚠️ 已知简化：脚本对**所有**记录都用「文章图片」通道的驱动拼 URL，
 * 未按 media.storageDriver 分别解析（相册若绑到另一个平台的档案，拼出的地址可能不对）。
 * 记录入库时平台不同的场景下，需要改成 getStorageDriverForPlatform(row.storageDriver, 'public')。
 * 失败明细会逐条列出，可先 --dry-run 确认再实跑。
 *
 * 用法：
 *   npm run media:backfill-dimensions              # 实际写入
 *   npm run media:backfill-dimensions -- --dry-run # 只预览，不写库
 */
import '@/lib/env/server/load';
import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { media } from '@/db/schema';
import { getPublicStorageDriver } from '@/lib/storage/server';
import { probeImageDimensions } from '@/lib/media/server';

const DRY_RUN = process.argv.includes('--dry-run');
/** 单张图片下载超时（毫秒） */
const FETCH_TIMEOUT = 20_000;

async function main() {
  console.log(`=== 回填图片宽高 ===${DRY_RUN ? '（dry-run 预览）' : ''}\n`);

  const rows = await db
    .select({
      id: media.id,
      url: media.url,
      storageKey: media.storageKey,
      width: media.width,
      height: media.height,
    })
    .from(media)
    .where(or(isNull(media.width), isNull(media.height)));

  console.log(`待回填记录：${rows.length} 条\n`);
  if (rows.length === 0) {
    console.log('=== 无需处理 ===');
    return;
  }

  const driver = await getPublicStorageDriver();
  console.log(`存储驱动：${driver.name}\n`);

  let updated = 0;
  const failed: Array<{ id: string; reason: string }> = [];

  for (const row of rows) {
    // 优先按 storageKey 走当前存储配置拼 URL，缺失时退回已存 URL
    let target: string;
    if (row.storageKey) {
      target = driver.getUrl(row.storageKey);
    } else {
      target = row.url;
    }
    if (!/^https?:\/\//i.test(target)) {
      failed.push({ id: row.id, reason: `非 http 地址：${target}` });
      continue;
    }

    try {
      const res = await fetch(target, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; blog-media/1.0)',
          Accept: 'image/*,*/*',
        },
      });
      if (!res.ok) {
        failed.push({ id: row.id, reason: `HTTP ${res.status}` });
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const dims = await probeImageDimensions(buffer);
      if (!dims) {
        failed.push({ id: row.id, reason: '尺寸探测失败（格式不支持或非图片）' });
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] ${row.id} → ${dims.width}x${dims.height}  ${target}`);
      } else {
        await db
          .update(media)
          .set({ width: dims.width, height: dims.height })
          .where(eq(media.id, row.id));
        console.log(`  ✓ ${row.id} → ${dims.width}x${dims.height}`);
      }
      updated++;
    } catch (error) {
      failed.push({
        id: row.id,
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  console.log(`\n${DRY_RUN ? '可回填' : '已回填'} ${updated} 条，失败 ${failed.length} 条\n`);
  if (failed.length > 0) {
    console.log('失败明细：');
    for (const f of failed) {
      console.log(`  ✗ ${f.id}：${f.reason}`);
    }
    console.log('\n失败记录不影响其他数据，可稍后重跑本脚本（只处理宽高为空的记录）。');
  }

  console.log('\n=== 完成 ===');
}

main().catch((error) => {
  console.error('回填失败：', error);
  process.exit(1);
});
