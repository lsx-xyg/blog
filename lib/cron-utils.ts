/**
 * T12 定时任务共享工具
 */
import { env } from "@/db/env";

/** 获取部署平台 */
export function getDeployPlatform(): "VERCEL" | "SERVER" {
  const platform = env("DEPLOY_PLATFORM");
  if (platform === "SERVER") return "SERVER";
  return "VERCEL"; // 默认 VERCEL
}
