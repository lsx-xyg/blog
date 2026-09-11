/** 后台 API 鉴权：未登录 / 非管理员一律 404 伪装（防探测，SPEC §6） */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/utils";

export async function requireAdmin(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return isAdminUser(session?.user) ? session : null;
}

export function adminDenied(): NextResponse {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}
