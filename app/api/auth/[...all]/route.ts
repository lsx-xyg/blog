/** Better Auth HTTP 入口（/api/auth/*：密码/GitHub 登录、会话、账号关联等） */
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
