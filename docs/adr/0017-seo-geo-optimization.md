# ADR-0017: SEO/GEO 优化——元数据兜底、结构化数据与 AI 引擎收录

- Status: **Accepted**
- Date: 2026-09-22

## Context

Bing 站长工具（URL 检查）对线上 `blog.dbthree.dpdns.org` 报告了一批问题，本地审计确认：

| 问题                                                            | 根因                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 首页「标题太短」（7 字：`林圣轩blog`）                          | `title.default` 直接用站名，无关键词兜底                                           |
| 首页/关于/友链/相册「Meta Description 太长或太短」（6~20 字）   | `seoDescription` 默认值仅 20 字；子页面描述是硬编码短句                            |
| 关于/友链标题重复拼接：`关于 \| 林圣轩blog \| 林圣轩blog`       | 子页面 `title` 手动拼了站名，又被根布局模板 `%s \| 站名` 再拼一次                  |
| 相册页缺少 `<h1>`                                               | 视觉由瀑布流主导，没有渲染标题                                                     |
| 文章 summary 过短/缺失时 description 直接过短/整体缺失          | `description: post.summary ?? undefined` 无兜底                                    |
| 无结构化数据（JSON-LD）、无 llms.txt、robots 未声明 AI 爬虫意图 | GEO（面向 AI 答案引擎的优化）缺失，ChatGPT Search / Perplexity / Claude 引用概率低 |

约束：

- 站名/描述来自 DB（settings 表），**代码不能假设用户会填长值**——线上恰好走的是默认值
- 不改变已锁定的视觉设计（DESIGN.md）：修复必须无视觉副作用（隐藏 H1 用 `sr-only`）
- 项目纪律：元数据组装逻辑要纯函数 + 单测（对齐 `lib/seo/shared/site-url.ts` 的先例）

## Decision

### 1. 元数据兜底组装（纯函数，`lib/seo/shared/meta.ts` + 单测）

「显式配置优先，代码只在过短时补足」：

- `buildHomeTitle(name, description, seoTitle?)`：`site.seoTitle` 显式配置优先；
  站名 < 15 字时自动拼上站点简介。首页 `<title>` 从 7 字 → 19 字。
- `buildHomeDescription(seoDescription, description)`：描述 < 30 字时用站点简介补足；
  > 160 字截断。首页描述从 20 字 → 72 字。
- `buildPostDescription(summary, markdown)`：summary ≥ 30 字直接用；过短/缺失时
  用 `buildExcerpt`（Markdown 正文 → 纯文本摘要）补足。
- 新增可选配置 `site.seoTitle`（DB key `site.seo_title`，默认空 = 自动组装），
  registry 一行声明 + 类型 + settings API + 后台表单同步，并带字数计数提示。

### 2. 修复标题重复拼接

about/links 页面 `title` 只写页面名（`关于本站与博主`），由根布局模板统一拼站名。

### 3. 缺失 H1 用 sr-only 补齐

相册页渲染 `<h1 className="sr-only">相册 - {site.name}</h1>`：语义上满足
「每页一个 H1」，视觉零影响。

### 4. GEO 三件套

- **JSON-LD**（`components/seo/json-ld.tsx`）：根布局输出 `WebSite` + `Person`；
  文章页输出 `BlogPosting` + `BreadcrumbList`（含 tags/摘要/封面/时间）。`<` 转义防注入。
- **llms.txt**（`app/llms.txt/route.ts`）：站点简介 + 全部已发布文章的 Markdown 清单，
  供 AI 答案引擎抓取（https://llmstxt.org）。
- **robots.txt**：显式放行 16 个主流 AI 爬虫（GPTBot / OAI-SearchBot / ClaudeBot /
  PerplexityBot / Google-Extended 等），与 `*` 规则等效但声明意图，防止未来收紧时误伤。

## Consequences

- 全部页面 title 15~29 字、description 37~96 字（Bing 建议区间），每页恰好一个 H1
- 后台「站点设置」新增 SEO 标题字段与字数提示，站长可自行微调文案
- 若 DB 中已有 `site.seo_description` 旧短值，兜底逻辑仍会自动补足到建议区间
- 未做（后续候选）：IndexNow（Bing 秒级提交）、og:image 动态生成、文章正文 Markdown
  一级标题降级为二级（防双 H1）、给存量 UUID 文章补 slug
