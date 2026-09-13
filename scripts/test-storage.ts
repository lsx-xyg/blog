/** 存储驱动测试脚本
 *
 * 用法：npx tsx scripts/test-storage.ts
 *
 * 测试内容：
 * 1. 从 picsum.photos 下载测试图片
 * 2. 测试本地驱动上传
 * 3. 测试本地驱动删除
 * 4. 测试 GitHub 驱动上传（如果配置了 GITHUB_TOKEN 且 STORAGE_DRIVER=GITHUB）
 */
import "../db/load-env";
import { getStorageDriverSync, resetStorageDriver } from "@/lib/storage";
import { validateImage } from "@/lib/storage";

async function main() {
  console.log("=== 存储驱动测试 ===\n");

  // 支持命令行参数指定驱动：npx tsx scripts/test-storage.ts github
  const driverArg = process.argv[2]?.toUpperCase();
  if (driverArg === "GITHUB" || driverArg === "LOCAL" || driverArg === "S3") {
    process.env.STORAGE_DRIVER = driverArg;
    resetStorageDriver();
    console.log(`（命令行强制指定驱动：${driverArg}）\n`);
  }

  // 1. 准备测试图片（1x1 红色 JPEG，base64 编码，避免依赖外部网络）
  console.log("1. 准备测试图片（1x1 红色 JPEG）...");
  const base64Image =
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==";
  const buffer = Buffer.from(base64Image, "base64");
  const mimeType = "image/jpeg";
  console.log(`   准备成功：${buffer.length} bytes，${mimeType}\n`);

  // 2. 校验图片
  console.log("2. 校验图片...");
  const validation = validateImage(mimeType, buffer.length);
  if (!validation.valid) {
    throw new Error(`图片校验失败：${validation.error}`);
  }
  console.log("   校验通过\n");

  // 3. 获取存储驱动
  console.log("3. 获取存储驱动...");
  const driver = getStorageDriverSync();
  console.log(`   使用驱动：${driver.name}\n`);

  // 4. 测试上传
  console.log("4. 测试上传...");
  const result = await driver.upload(buffer, "test-image.jpg", mimeType);
  console.log(`   上传成功：`);
  console.log(`     URL: ${result.url}`);
  console.log(`     Key: ${result.key}`);
  console.log(`     Size: ${result.size} bytes`);
  console.log(`     MIME: ${result.mimeType}\n`);

  // 5. 测试 getUrl
  console.log("5. 测试 getUrl...");
  const url = driver.getUrl(result.key);
  console.log(`   getUrl(${result.key}) = ${url}\n`);

  // 6. 测试删除
  console.log("6. 测试删除...");
  await driver.delete(result.key);
  console.log(`   删除成功：${result.key}\n`);

  console.log("=== 测试完成 ===");
}

main().catch((error) => {
  console.error("测试失败：", error);
  process.exit(1);
});
