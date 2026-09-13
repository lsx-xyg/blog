/**
 * T12 定时任务共享工具
 */

/**
 * 获取部署平台（支持环境变量和 DB 动态配置）
 * 环境变量优先级最高，DB 次之，默认 VERCEL
 */
export async function getDeployPlatform(): Promise<"VERCEL" | "SERVER"> {
  // 优先使用环境变量
  if (process.env.DEPLOY_PLATFORM) {
    return process.env.DEPLOY_PLATFORM.toUpperCase() === "SERVER" ? "SERVER" : "VERCEL";
  }
  // 动态导入避免循环依赖
  const { getCronConfig } = await import("@/lib/settings");
  const { deployPlatform } = await getCronConfig();
  return deployPlatform;
}
