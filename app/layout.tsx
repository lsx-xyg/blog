import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "blog",
  description: "林圣轩的个人博客：技术写作与生活记录",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      {/* suppressHydrationWarning：忽略浏览器扩展注入属性（如 data-atm-ext-installed）导致的水合差异 */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
