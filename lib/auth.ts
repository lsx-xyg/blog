/**
 * Better Auth 实例（SPEC §6：密码 + GitHub OAuth + 账号关联 + 引导）
 * - databaseHooks：用户表为空时第一个创建的用户自动置为 isAdmin（引导流程）
 * - accountLinking：GitHub 与密码账号按邮箱关联（trustedProviders 自动信任）
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/db/env";
import { users, sessions, accounts, verifications } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  secret: env("BETTER_AUTH_SECRET") ?? "dev-insecure-secret-change-me",
  baseURL: env("BETTER_AUTH_URL"),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // isAdmin 扩展列：禁止注册输入（input:false），仅由 databaseHooks 引导置位
    additionalFields: {
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  socialProviders: {
    github: {
      clientId: env("GITHUB_CLIENT_ID") ?? "",
      clientSecret: env("GITHUB_CLIENT_SECRET") ?? "",
    },
  },
  // 账号关联：GitHub 登录与现有同邮箱密码账号自动关联；登录后可手动绑定（linkSocial）
  accountLinking: {
    enabled: true,
    trustedProviders: ["github"],
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // 引导：第一个创建的用户（任意方式）自动成为管理员（SPEC §6）
          const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users);
          if (row && row.count <= 1) {
            await db
              .update(users)
              .set({ isAdmin: true })
              .where(eq(users.id, user.id));
          }
        },
      },
    },
  },
});
