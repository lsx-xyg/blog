import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";

/**
 * 无密码账号设置密码 API
 *
 * POST /api/admin/account/set-password
 * body: { newPassword: string }
 *
 * 适用场景：纯 GitHub OAuth 登录创建的管理员账号没有密码，
 * 无法使用密码二次验证（#18 reveal）。通过服务端调用
 * Better Auth 的 setPassword（serverOnly，客户端不可直接调用）
 * 为账号设置密码，之后即可使用密码登录与二次验证。
 *
 * 说明：Better Auth setPassword 内部会为账号创建 credential
 * 关联（若不存在），无需旧密码，也不检查邮箱验证。
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: { newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const newPassword = body.newPassword;
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "新密码至少 8 位" }, { status: 400 });
  }

  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: request.headers,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "设置失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
