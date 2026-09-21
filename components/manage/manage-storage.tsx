'use client';

/**
 * 后台「存储设置」独立页
 *
 * 从「站点设置」里拆出来的独立入口（/{adminSlug}/storage），
 * 目的是让存储配置有独立 URL：改配置 / 测试连通性时可以单独刷新，不用翻设置页分区。
 *
 * 内容全部来自 StorageProfilesManager（档案池 + 通道绑定），自管保存：
 * 档案与绑定的改动即时生效，与站点设置的「保存设置」按钮无关。
 */
import { HardDrive, Info } from 'lucide-react';
import { StorageProfilesManager } from '@/components/shared/storage-profiles-manager';

export function ManageStorage() {
  return (
    <div className="animate-page-enter">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold md:text-2xl">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          存储设置
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理存储档案（GitHub / R2 / WebDAV /
          本地），并为文章图片、相册图片、数据库备份分别指定使用哪个档案
        </p>
      </div>

      {/* 生效规则说明 */}
      <div className="mb-4 flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-400">
          <strong>保存后立即生效，无需点「保存设置」。</strong>
          敏感信息（Token / SecretKey / 密码）AES-256-GCM 加密存储，只显示「已配置」状态。
          切换通道绑定只影响<strong>新上传</strong>
          的文件——历史图片与备份按入库时记录的平台解析，永久可用。
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <StorageProfilesManager />
      </div>
    </div>
  );
}
