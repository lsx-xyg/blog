import Link from "next/link";

/** 页脚（参考站 czhlove.cn 一比一还原）：
 * - bg-muted/30 背景，py-12
 * - 站名 + 副标题
 * - 版权信息 + 技术栈
 */
export function Footer({
  siteName,
  copyright,
  icp,
}: {
  siteName: string;
  copyright: string;
  icp: string | null;
}) {
  return (
    <footer className="bg-muted/30 mt-8 md:mt-14 py-12 pb-28 md:pb-12">
      <div className="container mx-auto px-4 text-center">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{siteName}</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>{copyright}</p>
          {icp && (
            <p className="mt-1">
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {icp}
              </a>
            </p>
          )}
          <div className="flex gap-2 justify-center mt-3">
            <Link
              href="/rss.xml"
              className="flex gap-1 items-center hover:text-foreground transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-rss"
                aria-hidden="true"
              >
                <path d="M4 11a9 9 0 0 1 9 9" />
                <path d="M4 4a16 16 0 0 1 16 16" />
                <circle cx="5" cy="19" r="1" />
              </svg>
              <span className="mt-1">RSS订阅</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
