/**
 * T12 定时任务：SERVER 模式下使用 node-cron 内置定时任务
 *
 * 只在 DEPLOY_PLATFORM=SERVER 时启动，VERCEL 模式下使用 cron-job.org 外部定时任务
 *
 * 注意：
 * - instrumentation.ts 在应用启动时运行一次
 * - Vercel serverless 环境下可能会有多个实例，所以只在 SERVER 模式下启动
 * - 每分钟执行一次定时发布扫描
 */
export async function register() {
  // 只在 Node.js 运行时执行（不在 Edge 运行时执行）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // 动态 import，让打包器把这条链放到 Node bundle，不进 Edge bundle
      const { getDeployPlatform } = await import("@/lib/settings/server");
      const { CronDeployPlatform } = await import("@/lib/types/settings");

      // 数据库查询可能失败（Neon 冷启动/网络问题），失败时使用默认值 VERCEL
      let platform: string;
      try {
        platform = (await getDeployPlatform()) || CronDeployPlatform.VERCEL;
      } catch (e) {
        console.warn("[cron] 获取部署平台失败，使用默认值 VERCEL:", e instanceof Error ? e.message : e);
        platform = CronDeployPlatform.VERCEL;
      }

      // 只在 SERVER 模式下启动 node-cron
      if (platform === CronDeployPlatform.SERVER) {
        const { schedule } = await import("node-cron");
        const { publishScheduledPosts } = await import("@/lib/posts");
        const { revalidatePath } = await import("next/cache");

        console.log("[cron] SERVER 模式：启动 node-cron 定时任务（每分钟执行一次）");

        // 每分钟执行一次定时发布扫描
        schedule("* * * * *", async () => {
          try {
            console.log("[cron] 开始执行定时发布扫描...");
            const published = await publishScheduledPosts();

            if (published.length > 0) {
              console.log(`[cron] 发布了 ${published.length} 篇定时文章`);
              // 失效缓存
              revalidatePath("/");
              for (const post of published) {
                revalidatePath(`/posts/${post.slug ?? post.id}`);
              }
            } else {
              console.log("[cron] 没有到期的定时文章");
            }
          } catch (error) {
            console.error("[cron] 定时发布扫描失败：", error);
          }
        });
      } else {
        console.log("[cron] VERCEL 模式：使用 cron-job.org 外部定时任务，不启动 node-cron");
      }
    } catch (e) {
      // instrumentation hook 整体失败时不要崩溃，记录日志即可
      console.error("[cron] instrumentation hook 初始化失败:", e);
    }
  }
}
