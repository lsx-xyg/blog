/**
 * 拍摄时间（takenAt）本地时区转换（纯函数，可单测）
 *
 * 表单用 <input type="datetime-local">：值为本地时区、无时区后缀的 "YYYY-MM-DDTHH:mm"。
 * - 提交：localDatetimeToUtcIso → 本地时间解释为 Date → 转 UTC ISO 字符串存库（timestamptz）
 * - 展示：utcIsoToLocalDatetime → UTC ISO → 转回本地 datetime-local 值
 * 时区以运行环境为准（浏览器本地时区与服务器时区可能不同：
 * 转换在浏览器端完成，服务端只存/读 UTC ISO）。
 */

/** datetime-local 值 → UTC ISO 字符串；空/非法返回 null */
export function localDatetimeToUtcIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value); // datetime-local 按本地时区解析
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** UTC ISO 字符串 → datetime-local 表单值；空/非法返回 '' */
export function utcIsoToLocalDatetime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
