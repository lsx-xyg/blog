# 博客 Docker 镜像（多阶段构建，Next.js standalone 输出）
# 参考：https://nextjs.org/docs/app/building-your-application/deploying#docker-image
#
# 构建说明：
# - 非 Vercel 构建默认跳过数据库迁移（decideMigrate 规则 5）；
#   需要迁移时设置 build arg RUN_DB_MIGRATE=true 并传 DATABASE_URL(_UNPOOLED)
# - NEXT_PUBLIC_* 是构建时变量，必须通过 build args 传入，否则使用构建机默认值

# ---------- 依赖阶段 ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 构建阶段 ----------
FROM node:24-alpine AS builder
WORKDIR /app

# 构建时变量（NEXT_PUBLIC_* 在 next build 时内联进客户端代码）
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_NAME
ARG NEXT_PUBLIC_SITE_DESCRIPTION
ARG NEXT_PUBLIC_GISCUS_REPO
ARG NEXT_PUBLIC_GISCUS_REPO_ID
ARG NEXT_PUBLIC_GISCUS_CATEGORY
ARG NEXT_PUBLIC_GISCUS_CATEGORY_ID
# 可选：本次构建是否执行数据库迁移（首次部署 / schema 变更后设 true）
ARG RUN_DB_MIGRATE=false
ARG DATABASE_URL
ARG DATABASE_URL_UNPOOLED

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_SITE_DESCRIPTION=$NEXT_PUBLIC_SITE_DESCRIPTION \
    NEXT_PUBLIC_GISCUS_REPO=$NEXT_PUBLIC_GISCUS_REPO \
    NEXT_PUBLIC_GISCUS_REPO_ID=$NEXT_PUBLIC_GISCUS_REPO_ID \
    NEXT_PUBLIC_GISCUS_CATEGORY=$NEXT_PUBLIC_GISCUS_CATEGORY \
    NEXT_PUBLIC_GISCUS_CATEGORY_ID=$NEXT_PUBLIC_GISCUS_CATEGORY_ID \
    MIGRATE_ON_DEPLOY=$RUN_DB_MIGRATE \
    DATABASE_URL=$DATABASE_URL \
    DATABASE_URL_UNPOOLED=$DATABASE_URL_UNPOOLED

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# RUN_DB_MIGRATE=true 时，build 内的 db:migrate:deploy 会执行迁移（咨询锁防并发）；
# 否则跳过（decideMigrate 非 Vercel 构建默认跳过）
RUN npm run build

# ---------- 运行阶段（standalone） ----------
FROM node:24-alpine AS runner
WORKDIR /app

# 时区（定时任务按 Asia/Shanghai 计算）
ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN apk add --no-cache tzdata && \
    addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone 输出：server.js 自包含（node_modules 已内置），无需再 COPY node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# 健康检查（首页 200 即认为存活）
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
