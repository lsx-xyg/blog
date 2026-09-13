import { getAboutContent, getSiteSettings } from "@/lib/settings";
import { renderMdx } from "@/lib/mdx";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 动态生成关于页面 metadata */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: `关于 | ${site.name}`,
    description: `关于 ${site.name}`,
    alternates: {
      canonical: `${siteUrl}/about`,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [site, content] = await Promise.all([
    getSiteSettings(),
    getAboutContent(),
  ]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl animate-page-enter">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">关于</h1>
        <p className="mt-3 text-muted-foreground">{site.name}</p>
      </header>

      <article className="prose prose-neutral dark:prose-invert max-w-none">
        {renderMdx(content)}
      </article>
    </div>
  );
}
