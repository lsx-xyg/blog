import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "../db";
import { tags } from "../db/schema";

async function main() {
  // 插入（大小写敏感原样存储验证）
  const [tag] = await db.insert(tags).values({ name: "Nextjs", slug: "nextjs" }).returning();
  console.log("✅ 插入:", tag.id, "name=", tag.name);

  const [found] = await db.select().from(tags).where(eq(tags.id, tag.id));
  console.log(found?.name === "Nextjs" ? "✅ 查回原样（大小写敏感）" : "❌ 大小写被改写");

  const [dup] = await db.select().from(tags).where(eq(tags.name, "Nextjs"));
  console.log(dup ? "✅ 按 name 精确匹配可查" : "❌");

  await db.delete(tags).where(eq(tags.id, tag.id));
  console.log("✅ 删除完成，CRUD 冒烟通过");
  await sql.end();
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
