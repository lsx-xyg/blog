/**
 * 后台页面列表（server-only）：扫描 app/[adminSlug] 目录生成可选项，
 * 供引导配置页「页面」下拉选择，避免手写路径。
 */
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

export interface AdminPageOption {
  /** 相对后台路径，如 /settings、/（首页） */
  path: string;
  label: string;
}

const PAGE_LABELS: Record<string, string> = {
  "": "首页（仪表盘）",
  account: "账号设置",
  backup: "备份管理",
  cron: "定时任务",
  "friend-links": "友链管理",
  guides: "引导管理",
  media: "媒体库",
  posts: "文章管理",
  settings: "站点设置",
  tags: "标签管理",
};

export function getAdminPages(): AdminPageOption[] {
  const pages: AdminPageOption[] = [{ path: "/", label: PAGE_LABELS[""] ?? "首页" }];
  const dir = path.join(process.cwd(), "app/[adminSlug]");
  if (!existsSync(dir)) return pages;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    // 跳过动态段（[x]）、路由组（(x)）、非目录
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("[") || entry.name.startsWith("(")) continue;
    pages.push({
      path: `/${entry.name}`,
      label: PAGE_LABELS[entry.name] ?? entry.name,
    });
  }
  return pages;
}
