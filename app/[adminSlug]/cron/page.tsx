/** 后台定时任务管理：动态路径，未匹配/未授权一律 404 伪装 */
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { getAdminPathAsync } from '@/lib/admin/server';
import { isAdminUser } from '@/lib/shared';
import { ManageCronJobs } from '@/components/manage/manage-cron-jobs';
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb';

export const dynamic = 'force-dynamic';

export default async function AdminCronPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();
  if (adminSlug !== adminPath) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 animate-page-enter">
      <AdminBreadcrumb current="定时任务" adminPath={adminPath} />
      <ManageCronJobs />
    </div>
  );
}
