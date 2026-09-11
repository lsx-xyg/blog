"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { isAdminUser } from "@/lib/utils";

/** 前台顶栏：登录且 is_admin 时显示管理按钮（SPEC §6） */
export function SiteHeader({ adminPath }: { adminPath: string }) {
  const { data: session } = authClient.useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold">
          blog
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {isAdminUser(session?.user as { isAdmin?: boolean } | undefined) && (
            <Link href={`/${adminPath}`} className="text-accent hover:underline">
              后台
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
