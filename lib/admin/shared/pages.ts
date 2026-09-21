/**
 * 后台页面列表（server-only）
 *
 * 说明：后台路由采用**静态清单**，而非运行时扫描 app/[adminSlug] 目录——
 * Vercel 等部署环境为 Next.js standalone 输出，源码 app/ 目录不随产物分发，
 * 运行时 readdirSync 会失败导致列表只剩首页。新增后台页面时，请同步在
 * ADMIN_PAGES 增加一项；lib/shared/admin-pages.test.ts 会用文件系统扫描校验
 * 清单没有遗漏（测试失败即提醒）。
 */
export interface AdminPageOption {
  /** 相对后台路径，如 /settings、/（首页） */
  path: string;
  label: string;
}

export const ADMIN_PAGES: AdminPageOption[] = [
  { path: '/', label: '首页（仪表盘）' },
  { path: '/account', label: '账号设置' },
  { path: '/backup', label: '备份管理' },
  { path: '/cron', label: '定时任务' },
  { path: '/friend-links', label: '友链管理' },
  { path: '/guides', label: '引导管理' },
  { path: '/media', label: '媒体库' },
  { path: '/posts', label: '文章管理' },
  { path: '/posts/new', label: '新建文章' },
  { path: '/settings', label: '站点设置' },
  { path: '/storage', label: '存储设置' },
  { path: '/tags', label: '标签管理' },
];

export function getAdminPages(): AdminPageOption[] {
  return ADMIN_PAGES;
}
