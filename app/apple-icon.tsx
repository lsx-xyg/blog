import { ImageResponse } from "next/og";
import { cookies } from "next/headers";
import { LIN_SERIF_BOLD_BASE64 } from "@/lib/favicon-font";

/**
 * Apple 主屏图标（apple-touch-icon，180×180 PNG）。
 *
 * 与 app/icon.tsx 同一套主题配色，用「林」字子集字体渲染
 * （base64 内联，仅含「林」字，约 4KB，Vercel standalone 兼容）。
 * iOS 保存到主屏时按当前主题生成对应颜色。
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

type ThemeColors = { bg: string; fg: string };

const THEME_COLORS: Record<string, ThemeColors> = {
  light: { bg: "#ffffff", fg: "#18181b" },
  dark: { bg: "#0a0a0b", fg: "#fafafa" },
  warm: { bg: "#f7f1e3", fg: "#3a332b" },
  system: { bg: "#1f1f23", fg: "#ffffff" },
};

export default async function AppleIcon() {
  const cookieStore = await cookies();
  const theme = cookieStore.get("site-theme")?.value ?? "system";
  const c = THEME_COLORS[theme] ?? THEME_COLORS.system;

  // Buffer.from 可能落在共享 Buffer 池上，必须 slice 出精确 ArrayBuffer，
  // 否则 opentype 解析会因底层 buffer 越界报 DataView 错
  const buf = Buffer.from(LIN_SERIF_BOLD_BASE64, "base64");
  const fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.bg,
        color: c.fg,
        fontSize: 110,
        fontWeight: 700,
        fontFamily: "LinSerif",
      }}
    >
      林
    </div>,
    {
      ...size,
      fonts: [{ name: "LinSerif", data: fontData, weight: 700 }],
    },
  );
}
