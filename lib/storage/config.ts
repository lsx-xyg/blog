/**
 * 存储配置模块（T2 动态配置）
 *
 * 配置优先级：环境变量 > DB settings 表 > 默认值
 *
 * 非敏感配置可在后台设置页动态修改：
 * - storage.driver: 当前使用的驱动
 * - storage.github.owner/repo/branch/cdn_base
 * - storage.s3.endpoint/bucket/region
 * - storage.local.upload_dir
 *
 * 敏感信息（Token/Secret Key）加密后存储在 DB 中：
 * - storage.github.token（AES-256-GCM 加密）
 * - storage.s3.access_key / storage.s3.secret_key（AES-256-GCM 加密）
 *
 * 加密密钥：ENCRYPTION_KEY 环境变量（32 字节 Base64）
 * 环境变量中的敏感信息优先级最高（GITHUB_STORAGE_TOKEN / S3_ACCESS_KEY / S3_SECRET_KEY）
 */
import { getSetting } from "@/lib/settings";
import { decryptIfAvailable } from "@/lib/crypto";

/** 存储驱动类型 */
export type StorageDriverType = "LOCAL" | "GITHUB" | "S3";

/** 存储配置类型（含敏感信息，解密后的明文） */
export type StorageConfig = {
  driver: StorageDriverType;
  github: {
    owner: string;
    repo: string;
    branch: string;
    cdnBase: string;
    token: string;
  };
  s3: {
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
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
    token: "",
  },
  s3: {
    endpoint: "",
    bucket: "",
    region: "auto",
    accessKey: "",
    secretKey: "",
  },
  local: {
    uploadDir: "public/uploads",
  },
};

/**
 * 从 DB 读取存储配置（环境变量优先级最高，DB 次之，默认值兜底）
 *
 * 敏感信息从 DB 读取后解密，环境变量中的敏感信息优先级最高。
 */
export async function getStorageConfig(): Promise<StorageConfig> {
  // 读取 driver（环境变量 > DB > 默认）
  const envDriver = (process.env.STORAGE_DRIVER || "").toUpperCase();
  const dbDriver = await getSetting<string>("storage.driver");
  let driver: StorageDriverType = DEFAULT_CONFIG.driver;
  if (envDriver && ["LOCAL", "GITHUB", "S3"].includes(envDriver)) {
    driver = envDriver as StorageDriverType;
  } else if (dbDriver && ["LOCAL", "GITHUB", "S3"].includes(dbDriver.toUpperCase())) {
    driver = dbDriver.toUpperCase() as StorageDriverType;
  }

  // 读取 GitHub 配置（环境变量 > DB > 默认）
  const [ghOwner, ghRepo, ghBranch, ghCdnBase, ghTokenEncrypted] = await Promise.all([
    getSetting<string>("storage.github.owner"),
    getSetting<string>("storage.github.repo"),
    getSetting<string>("storage.github.branch"),
    getSetting<string>("storage.github.cdn_base"),
    getSetting<string>("storage.github.token"),
  ]);

  // 读取 S3 配置（环境变量 > DB > 默认）
  const [s3Endpoint, s3Bucket, s3Region, s3AccessKeyEncrypted, s3SecretKeyEncrypted] = await Promise.all([
    getSetting<string>("storage.s3.endpoint"),
    getSetting<string>("storage.s3.bucket"),
    getSetting<string>("storage.s3.region"),
    getSetting<string>("storage.s3.access_key"),
    getSetting<string>("storage.s3.secret_key"),
  ]);

  // 读取 LOCAL 配置（环境变量 > DB > 默认）
  const localUploadDir = await getSetting<string>("storage.local.upload_dir");

  // 解密敏感信息（环境变量优先级最高）
  const githubToken = process.env.GITHUB_STORAGE_TOKEN || decryptIfAvailable(ghTokenEncrypted) || "";
  const s3AccessKey = process.env.S3_ACCESS_KEY || decryptIfAvailable(s3AccessKeyEncrypted) || "";
  const s3SecretKey = process.env.S3_SECRET_KEY || decryptIfAvailable(s3SecretKeyEncrypted) || "";

  return {
    driver,
    github: {
      owner: process.env.GITHUB_STORAGE_OWNER || ghOwner || DEFAULT_CONFIG.github.owner,
      repo: process.env.GITHUB_STORAGE_REPO || ghRepo || DEFAULT_CONFIG.github.repo,
      branch: process.env.GITHUB_STORAGE_BRANCH || ghBranch || DEFAULT_CONFIG.github.branch,
      cdnBase: process.env.GITHUB_STORAGE_CDN_BASE || ghCdnBase || DEFAULT_CONFIG.github.cdnBase,
      token: githubToken,
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT || s3Endpoint || DEFAULT_CONFIG.s3.endpoint,
      bucket: process.env.S3_BUCKET || s3Bucket || DEFAULT_CONFIG.s3.bucket,
      region: process.env.S3_REGION || s3Region || DEFAULT_CONFIG.s3.region,
      accessKey: s3AccessKey,
      secretKey: s3SecretKey,
    },
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || localUploadDir || DEFAULT_CONFIG.local.uploadDir,
    },
  };
}

/**
 * 敏感信息：直接从环境变量读取（同步版本，用于无法异步的场景）
 * 注意：这个函数不会读取 DB 中的加密配置，只使用环境变量。
 */
export function getStorageSecrets() {
  return {
    githubToken: process.env.GITHUB_STORAGE_TOKEN || "",
    s3AccessKey: process.env.S3_ACCESS_KEY || "",
    s3SecretKey: process.env.S3_SECRET_KEY || "",
  };
}
