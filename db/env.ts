/**
 * 环境变量读取（SPEC §12：全大写 + 小写自动转大写兜底）
 */
export function env(name: string): string | undefined {
  return process.env[name] ?? process.env[name.toLowerCase()];
}
