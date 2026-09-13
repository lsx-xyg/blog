import { listFriendLinks } from "@/lib/friend-links";
import { getSiteSettings } from "@/lib/settings";
import { Link2 } from "lucide-react";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 动态生成友链页面 metadata */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: `友链 | ${site.name}`,
    description: `${site.name} 的友情链接`,
    alternates: {
      canonical: `${siteUrl}/links`,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const [site, links] = await Promise.all([
    getSiteSettings(),
    listFriendLinks(),
  ]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl animate-page-enter">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">友情链接</h1>
        <p className="mt-3 text-muted-foreground">共 {links.length} 个友链</p>
      </header>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Link2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">还没有友链，管理员可以在后台添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link, index) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                {link.avatarUrl ? (
                  <img
                    src={link.avatarUrl}
                    alt={link.name}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {link.name}
                  </h3>
                  {link.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {link.description}
                    </p>
                  )}
                  {link.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {link.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
