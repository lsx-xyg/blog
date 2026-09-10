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
      <body>{children}</body>
    </html>
  );
}
