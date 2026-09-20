/**
 * 一次性迁移：把历史图片外链 URL 替换为站内路由地址 /m/{storageKey}
 *
 * 背景：站内路由方案（app/m/[...key]）上线前的旧图片，media.url 和文章
 * content/coverUrl 里存的是上传时的图床完整 URL（jsDelivr / raw / 自建代理）。
 * 本脚本按 media.storageKey 反查替换，并兜底处理「media 记录缺失但 URL 符合
 * 当前 GitHub 仓库配置」的图片。
 *
 * 用法：
 *   npm run storage:migrate-urls            # 实际写入
 *   npm run storage:migrate-urls -- --dry-run   # 只预览，不写库
 *
 * 迁移完成后建议后台任意保存一次设置（触发 ISR 相关缓存刷新），
 * 文章页 ISR 60s 内自动更新。
 */
import '@/lib/env/server/load';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { media, posts } from '@/db/schema';
import { getStorageSettings } from '@/lib/settings/server';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== 图片 URL 迁移 → 站内路由 /m/{key} ===${DRY_RUN ? '（dry-run 预览）' : ''}\n`);

  // 1. 建立 旧外链 → /m/{key} 映射（以 media 表为准）
  const mediaRows = await db
    .select({ id: media.id, url: media.url, storageKey: media.storageKey })
    .from(media);

  const urlMap = new Map<string, string>(); // oldUrl → /m/{key}
  for (const row of mediaRows) {
    if (!row.storageKey) continue;
    if (!/^https?:\/\//i.test(row.url)) continue; // 已是站内地址，跳过
    urlMap.set(row.url, `/m/${row.storageKey}`);
  }
  console.log(`media 表：共 ${mediaRows.length} 条，其中待迁移外链 ${urlMap.size} 条\n`);

  // 2. 更新 media.url
  let mediaUpdated = 0;
  for (const row of mediaRows) {
    const newUrl = urlMap.get(row.url);
    if (!newUrl) continue;
    if (DRY_RUN) {
      console.log(`  [media] ${row.url} → ${newUrl}`);
    } else {
      await db.update(media).set({ url: newUrl }).where(eq(media.id, row.id));
    }
    mediaUpdated++;
  }
  console.log(`media.url 更新：${mediaUpdated} 条\n`);

  // 3. 兜底映射：media 表缺失但符合当前 GitHub 仓库配置的 URL
  //    jsDelivr:   {base}/{owner}/{repo}@{branch}/{path}
  //    raw/代理:  {prefix containing raw.githubusercontent.com}/{owner}/{repo}/{branch}/{path}
  const storage = await getStorageSettings();
  const { owner, repo, branch, directory } = storage.github;
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const dirPrefix = directory ? `${escapeRe(directory)}/` : '';
  const githubPatterns: RegExp[] = [
    // jsDelivr @branch 格式
    new RegExp(
      `https?://[^\\s)"'\\\\]*jsdelivr\\.net/gh/${escapeRe(owner)}/${escapeRe(repo)}@${escapeRe(branch)}/(${dirPrefix}[^\\s)"'\\\\]+)`,
      'gi',
    ),
    // raw 直连及各类反代（前缀里含 raw.githubusercontent.com）
    new RegExp(
      `https?://[^\\s)"'\\\\]*raw\\.githubusercontent\\.com/${escapeRe(owner)}/${escapeRe(repo)}/${escapeRe(branch)}/(${dirPrefix}[^\\s)"'\\\\]+)`,
      'gi',
    ),
  ];

  // 4. 替换文章 content / coverUrl
  const postRows = await db
    .select({ id: posts.id, content: posts.content, coverUrl: posts.coverUrl })
    .from(posts);

  let postsUpdated = 0;
  for (const post of postRows) {
    let content = post.content;
    let coverUrl = post.coverUrl;
    const before = content + (coverUrl ?? '');

    // 4a. media 精确映射替换
    for (const [oldUrl, newUrl] of urlMap) {
      if (content.includes(oldUrl)) content = content.split(oldUrl).join(newUrl);
      if (coverUrl === oldUrl) coverUrl = newUrl;
    }

    // 4b. GitHub 模式兜底替换（捕获的 fullPath 含子目录前缀，
    //     而 /m/{key} 的 key 不含子目录——路由会经 getUrl 自动补回，需先剥掉）
    const stripDir = (fullPath: string) =>
      directory && fullPath.startsWith(`${directory}/`)
        ? fullPath.slice(directory.length + 1)
        : fullPath;
    for (const pattern of githubPatterns) {
      content = content.replace(pattern, (_match, fullPath: string) => `/m/${stripDir(fullPath)}`);
      if (coverUrl) {
        coverUrl = coverUrl.replace(
          pattern,
          (_match, fullPath: string) => `/m/${stripDir(fullPath)}`,
        );
      }
    }

    if (content !== post.content || coverUrl !== post.coverUrl) {
      console.log(
        `  [post] ${post.id} ${content.length !== post.content.length ? '(content)' : ''}${coverUrl !== post.coverUrl ? ' (coverUrl)' : ''}`,
      );
      if (DRY_RUN) {
        console.log(`    before: ${before.slice(0, 120).replace(/\n/g, ' ')}...`);
      } else {
        await db
          .update(posts)
          .set({ content, coverUrl, updatedAt: new Date() })
          .where(eq(posts.id, post.id));
      }
      postsUpdated++;
    }
  }

  console.log(`\n文章更新：${postsUpdated} 篇`);
  console.log(DRY_RUN ? '\n=== dry-run 结束，未写入任何数据 ===' : '\n=== 迁移完成 ===');
  if (!DRY_RUN && postsUpdated > 0) {
    console.log('提示：文章页 ISR 60s 内自动刷新；如需立即生效可在后台重新保存文章。');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('迁移失败：', error);
    process.exit(1);
  });
