import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { getSetting } from "@/lib/settings/server";
import { decryptIfAvailable } from "@/lib/shared/crypto";
import { db } from "@/db";
import { accounts } from "@/db/schema";

/**
 * 敏感信息查看 API（#18：二次验证）
 *
 * POST /api/admin/settings/reveal
 * body: { key: string, password: string }
 *
 * 流程：
 * 1. 校验当前会话为管理员
 * 2. 检查账号是否设置了密码（纯 GitHub OAuth 账号无密码 → 403 引导先设置密码）
 * 3. 用 Better Auth 校验管理员密码（二次验证，不信任当前会话本身）
 * 4. 按白名单读取对应加密值并解密，只返回单个字段
 * 5. 记录查看日志（谁、何时、查看了哪个字段）
 *
 * 安全：
 * - 字段白名单限制，无法越权读取其他配置
 * - 响应 Cache-Control: no-store，明文不落缓存
 * - 明文只在前端临时展示，不写入表单提交值
 */

/** 可查看的敏感字段白名单（前端 key → DB setting key） */
const SECRET_KEYS: Record<string, string> = {
  "storage.github.token": "storage.github.token",
  "storage.s3.accessKey": "storage.s3.access_key",
  "storage.s3.secretKey": "storage.s3.secret_key",
  "storage_private.github.token": "storage_private.github.token",
  "storage_private.s3.accessKey": "storage_private.s3.access_key",
  "storage_private.s3.secretKey": "storage_private.s3.secret_key",
  "cron.secret": "cron.secret",
  "cron.jobApiKey": "cron.job_api_key",
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: { key?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const key = body.key;
  const password = body.password;
  const dbKey = typeof key === "string" ? SECRET_KEYS[key] : undefined;
  if (!dbKey) {
    return NextResponse.json({ error: "不支持的字段" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "请输入管理员密码" }, { status: 400 });
  }

  // 二次验证：校验管理员密码（用当前会话邮箱）
  const email = session.user.email;
  if (!email) {
    return NextResponse.json({ error: "当前账号无邮箱，无法验证" }, { status: 400 });
  }

  // 纯 GitHub OAuth 账号没有密码：引导先设置密码，再使用密码二次验证
  const [credentialAccount] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.providerId, "credential")
      )
    );
  if (!credentialAccount?.password) {
    return NextResponse.json(
      { error: "当前账号未设置密码，请先在「账号设置」中设置密码后，再使用明文查看功能", code: "NO_PASSWORD" },
      { status: 403 }
    );
  }

  try {
    // 验证密码正确性；验证产生的临时 session 依赖 better-auth 过期机制自动清理
    await auth.api.signInEmail({
      body: { email, password },
    });
  } catch {
    return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
  }

  // 读取并解密目标字段
  const encrypted = await getSetting<string>(dbKey);
  if (!encrypted) {
    return NextResponse.json({ error: "该字段尚未配置" }, { status: 404 });
  }
  const value = decryptIfAvailable(encrypted);

  // 查看日志（谁、何时、查看了哪个字段）
  console.log(
    `[SECRET-REVEAL] user=${email} key=${key} at=${new Date().toISOString()}`
  );

  return NextResponse.json(
    { value },
    { headers: { "Cache-Control": "no-store" } }
  );
}
