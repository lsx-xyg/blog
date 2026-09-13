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
    const platform = process.env.DEPLOY_PLATFORM || "VERCEL";

    // 只在 SERVER 模式下启动 node-cron
    if (platform === "SERVER") {
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
  }
}
