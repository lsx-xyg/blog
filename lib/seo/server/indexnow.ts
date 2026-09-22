/**
 * IndexNow 即时索引协议（https://indexnow.org，Bing / Yandex / Seznam / Naver / Yep 共用）。
 *
 * 工作方式：站点在根目录托管 {key}.txt 密钥文件证明所有权，
 * 内容发布/更新时向 api.indexnow.org 推送 URL，参与的引擎共享通知，
 * 通常分钟级即可完成抓取（对比等爬虫自行发现的小时/天级）。
 *
 * 本模块分两层：
 * - 纯函数（generateIndexNowKey / buildIndexNowPayload / chunkUrlList /
 *   describeIndexNowStatus / isValidIndexNowKey）：可单测，不触库不联网
 * - 服务端函数（getIndexNowKey / submitUrlsToIndexNow / notifyPostsChanged）：
 *   读取 seo.* 设置、调 ensure 密钥、发 HTTP；所有失败均吞掉并落进结果对象，
 *   绝不向上抛——收录推送是尽力而为的旁路，不能拖垮发布主流程。
 *
 * 注意：Google 不参与 IndexNow（其 Indexing API 仅限 JobPosting/BroadcastEvent，
 * sitemap ping 端点已下线），Google 侧靠 sitemap + Search Console。
 */
import { getConfig } from '@/lib/settings/server';
import { getSiteUrlAsync } from '@/lib/seo/shared';
import type { IndexNowPayload, IndexNowResult } from '@/lib/types/seo';

/** IndexNow 官方聚合端点：一次提交，所有参与引擎共享 */
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** 单次请求最多允许的 URL 数（协议上限 10000） */
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;

/** 请求超时（毫秒）：推送是旁路，超时即放弃 */
const REQUEST_TIMEOUT_MS = 10_000;

/* ---------------- 纯函数 ---------------- */

/**
 * 生成 IndexNow 密钥：32 位十六进制（协议要求 8~128 位 hex）。
 * 基于 crypto.randomUUID 去连字符，足够随机且无依赖。
 */
export function generateIndexNowKey(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** 校验密钥格式（8~128 位十六进制） */
export function isValidIndexNowKey(key: string): boolean {
  return /^[0-9a-f]{8,128}$/.test(key);
}

/**
 * 组装 IndexNow 请求体。
 *
 * @param host      站点主机名（如 blog.dbthree.dpdns.org）
 * @param key       密钥
 * @param urlList   要提交的 URL 列表
 * @param keyLocation 密钥文件完整 URL（/{key}.txt），缺省时省略该字段
 */
export function buildIndexNowPayload(params: {
  host: string;
  key: string;
  urlList: string[];
  keyLocation?: string;
}): IndexNowPayload {
  const payload: IndexNowPayload = {
    host: params.host,
    key: params.key,
    urlList: params.urlList,
  };
  if (params.keyLocation) payload.keyLocation = params.keyLocation;
  return payload;
}

/** 按协议上限分块（10000 条/次） */
export function chunkUrlList(urls: string[], size = INDEXNOW_MAX_URLS_PER_REQUEST): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += size) {
    chunks.push(urls.slice(i, i + size));
  }
  return chunks;
}

/** 解读 IndexNow 响应状态码（协议规定语义） */
export function describeIndexNowStatus(status: number): { ok: boolean; message: string } {
  switch (status) {
    case 200:
      return { ok: true, message: '提交成功（200 OK）' };
    case 202:
      return { ok: true, message: '已受理（202 Accepted）：密钥验证仍在进行，稍后生效' };
    case 400:
      return { ok: false, message: '无效请求（400）：请求体或 URL 格式不合法' };
    case 403:
      return { ok: false, message: '被拒（403）：密钥文件校验失败，请确认 /{key}.txt 可访问' };
    case 422:
      return { ok: false, message: '不支持的 URL（422）：提交的 URL 与站点主机不匹配' };
    case 429:
      return { ok: false, message: '限流（429）：提交过于频繁，请稍后再试' };
    default:
      return { ok: false, message: `未知响应（HTTP ${status}）` };
  }
}

/* ---------------- 服务端函数 ---------------- */

/** 读取 IndexNow 开关（seo.indexNowEnabled） */
export async function isIndexNowEnabled(): Promise<boolean> {
  try {
    return await getConfig('seo.indexNowEnabled');
  } catch {
    return false;
  }
}

/**
 * 读取 IndexNow 密钥；未配置时自动生成 32 位 hex 并持久化（幂等）。
 * 密钥本身是公开值（要通过 /{key}.txt 公开给引擎校验），无需加密存储。
 */
export async function getIndexNowKey(): Promise<string> {
  const configured = await getConfig('seo.indexNowKey');
  if (configured && isValidIndexNowKey(String(configured))) return String(configured);

  const generated = generateIndexNowKey();
  const { setSetting } = await import('@/lib/settings/server');
  await setSetting('seo.indexNowKey', generated);
  return generated;
}

/**
 * 提交一组 URL 到 IndexNow。
 *
 * - 未启用 / 列表为空：返回 ok=false 与原因，不发请求
 * - 按 10000 条/次分块提交，逐块统计
 * - 任何异常（网络/超时/DB）都吞掉，转成结果对象——发布主流程绝不能因此失败
 */
export async function submitUrlsToIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { ok: false, status: null, message: '没有可提交的 URL', submitted: 0 };
  }
  if (!(await isIndexNowEnabled())) {
    return {
      ok: false,
      status: null,
      message: 'IndexNow 未启用（后台「搜索收录」中可开启）',
      submitted: 0,
    };
  }

  try {
    const siteUrl = await getSiteUrlAsync();
    const host = new URL(siteUrl).host;
    const key = await getIndexNowKey();
    const keyLocation = `${siteUrl}/${key}.txt`;

    const chunks = chunkUrlList(urls);
    let submitted = 0;
    let lastStatus: number | null = null;
    let lastMessage = '';

    for (const chunk of chunks) {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(buildIndexNowPayload({ host, key, urlList: chunk, keyLocation })),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      lastStatus = res.status;
      const described = describeIndexNowStatus(res.status);
      lastMessage = described.message;
      if (described.ok) submitted += chunk.length;
      else break; // 某块失败即停止（通常是密钥/限流问题，继续发也会失败）
    }

    return {
      ok: lastStatus !== null && describeIndexNowStatus(lastStatus).ok,
      status: lastStatus,
      message: lastMessage,
      submitted,
      endpoint: INDEXNOW_ENDPOINT,
    };
  } catch (e) {
    console.warn('[indexnow] 提交失败（不影响发布流程）：', e);
    return {
      ok: false,
      status: null,
      message: `网络错误：${e instanceof Error ? e.message : String(e)}`,
      submitted: 0,
    };
  }
}

/**
 * 文章发布/更新后的旁路通知：拼出文章 URL 并推送 IndexNow。
 * 给 after() 用的入口，内部全兜底，永不抛错。
 */
export async function notifyPostsChanged(
  posts: { id: string; slug: string | null }[],
): Promise<void> {
  try {
    if (posts.length === 0) return;
    const siteUrl = await getSiteUrlAsync();
    const urls = posts.map((p) => `${siteUrl}/posts/${p.slug ?? p.id}`);
    const result = await submitUrlsToIndexNow(urls);
    console.info(`[indexnow] 文章推送：${result.submitted}/${urls.length}（${result.message}）`);
  } catch (e) {
    console.warn('[indexnow] 文章推送异常（已忽略）：', e);
  }
}
