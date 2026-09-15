import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { accounts } from "@/db/schema";

/**
 * 管理员账号密码状态查询
 *
 * GET /api/admin/account/status
 * 返回 { hasPassword: boolean }
 *
 * 用途：敏感信息「查看」按钮点击前先判断账号是否有密码。
 * 纯 GitHub OAuth 创建的管理员账号无密码，应直接引导设置密码，
 * 而不是先弹密码输入框（#18）。
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const [credentialAccount] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.providerId, "credential")
      )
    );

  return NextResponse.json({
    hasPassword: Boolean(credentialAccount?.password),
  });
}
