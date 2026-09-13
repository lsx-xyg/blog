/**
 * 存储配置模块（T2 动态配置）
 *
 * 配置优先级：DB settings 表 > 环境变量 > 默认值
 *
 * 敏感信息（Token/Secret Key）只从环境变量读取，不存数据库：
 * - GITHUB_STORAGE_TOKEN
 * - S3_ACCESS_KEY / S3_SECRET_KEY
 *
 * 非敏感配置可在后台设置页动态修改：
 * - storage.driver: 当前使用的驱动
 * - storage.github.owner/repo/branch/cdn_base
 * - storage.s3.endpoint/bucket/region
 * - storage.local.upload_dir
 */
import { getSetting } from "@/lib/settings";

/** 存储驱动类型 */
export type StorageDriverType = "LOCAL" | "GITHUB" | "S3";

/** 存储配置类型 */
export type StorageConfig = {
  driver: StorageDriverType;
  github: {
    owner: string;
    repo: string;
    branch: string;
    cdnBase: string;
  };
  s3: {
    endpoint: string;
    bucket: string;
    region: string;
  };
  local: {
    uploadDir: string;
  };
};

/** 默认配置 */
const DEFAULT_CONFIG: StorageConfig = {
  driver: "LOCAL",
  github: {
    owner: "lsx-xyg",
    repo: "images",
    branch: "main",
    cdnBase: "https://cdn.jsdelivr.net/gh",
  },
  s3: {
    endpoint: "",
    bucket: "",
    region: "auto",
  },
  local: {
    uploadDir: "public/uploads",
  },
};

/**
 * 从 DB 读取存储配置（环境变量兜底）
 *
 * 注意：这是异步函数，因为需要查询数据库。
 * 敏感信息（Token/Secret）不在这里，直接从环境变量读取。
 */
export async function getStorageConfig(): Promise<StorageConfig> {
  // 读取 driver（DB > 环境变量 > 默认）
  const dbDriver = await getSetting<string>("storage.driver");
  const envDriver = (process.env.STORAGE_DRIVER || "").toUpperCase();
  let driver: StorageDriverType = DEFAULT_CONFIG.driver;
  if (dbDriver && ["LOCAL", "GITHUB", "S3"].includes(dbDriver.toUpperCase())) {
    driver = dbDriver.toUpperCase() as StorageDriverType;
  } else if (envDriver && ["LOCAL", "GITHUB", "S3"].includes(envDriver)) {
    driver = envDriver as StorageDriverType;
  }

  // 读取 GitHub 配置（DB > 环境变量 > 默认）
  const [ghOwner, ghRepo, ghBranch, ghCdnBase] = await Promise.all([
    getSetting<string>("storage.github.owner"),
    getSetting<string>("storage.github.repo"),
    getSetting<string>("storage.github.branch"),
    getSetting<string>("storage.github.cdn_base"),
  ]);

  // 读取 S3 配置（DB > 环境变量 > 默认）
  const [s3Endpoint, s3Bucket, s3Region] = await Promise.all([
    getSetting<string>("storage.s3.endpoint"),
    getSetting<string>("storage.s3.bucket"),
    getSetting<string>("storage.s3.region"),
  ]);

  // 读取 LOCAL 配置（DB > 环境变量 > 默认）
  const localUploadDir = await getSetting<string>("storage.local.upload_dir");

  return {
    driver,
    github: {
      owner: ghOwner || process.env.GITHUB_STORAGE_OWNER || DEFAULT_CONFIG.github.owner,
      repo: ghRepo || process.env.GITHUB_STORAGE_REPO || DEFAULT_CONFIG.github.repo,
      branch: ghBranch || process.env.GITHUB_STORAGE_BRANCH || DEFAULT_CONFIG.github.branch,
      cdnBase: ghCdnBase || process.env.GITHUB_STORAGE_CDN_BASE || DEFAULT_CONFIG.github.cdnBase,
    },
    s3: {
      endpoint: s3Endpoint || process.env.S3_ENDPOINT || DEFAULT_CONFIG.s3.endpoint,
      bucket: s3Bucket || process.env.S3_BUCKET || DEFAULT_CONFIG.s3.bucket,
      region: s3Region || process.env.S3_REGION || DEFAULT_CONFIG.s3.region,
    },
    local: {
      uploadDir: localUploadDir || process.env.LOCAL_UPLOAD_DIR || DEFAULT_CONFIG.local.uploadDir,
    },
  };
}

/** 敏感信息：直接从环境变量读取（不存 DB） */
export function getStorageSecrets() {
  return {
    githubToken: process.env.GITHUB_STORAGE_TOKEN || "",
    s3AccessKey: process.env.S3_ACCESS_KEY || "",
    s3SecretKey: process.env.S3_SECRET_KEY || "",
  };
}
