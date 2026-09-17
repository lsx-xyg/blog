/**
 * 后台 API 公共壳：鉴权 + 统一错误响应。
 *
 * 目标：让每个 route.ts 只写「业务」，样板（鉴权、错误包装）收敛在这一处。
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";

/** 统一错误响应（所有后台 API 同构） */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 管理员鉴权守卫。
 * @returns 通过时返回 null；未通过时返回可直接 return 的 401 响应
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return apiError("未授权", 401);
  }
  return null;
}
