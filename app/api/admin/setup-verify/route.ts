/** 引导密钥校验：仅当用户表为空且 env 配置了 SETUP_SECRET 时可用 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/db/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  // 引导已完成 → 接口失效
  if ((row?.count ?? 0) > 0) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const expected = env("SETUP_SECRET");
  if (!expected) {
    return NextResponse.json({ ok: true });
  }
  const body = await req.json().catch(() => null);
  if (!body || body.secret !== expected) {
    return NextResponse.json({ error: "密钥不正确" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
