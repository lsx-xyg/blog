"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 浏览量：初始值来自服务端渲染，挂载后客户端上报 +1。
 * 幂等策略（修复 T4 复测 bug 3/4）：
 * - ref 标记：防 React StrictMode 开发模式双调用 effect（+2 问题）
 * - sessionStorage 乐观标记：发起上报前立即落标记，防快速连点/导航中断
 *   导致的多次上报（同浏览器会话内每篇文章只计 1 次）
 * 局限：同会话刷新不重复计数；生产级 IP+日期去重留待后续服务端方案
 */
export function ViewCounter({
  initial,
  slugOrId,
}: {
  initial: number;
  slugOrId: string;
}) {
  const [count, setCount] = useState(initial);
  const countedRef = useRef(false);

  useEffect(() => {
    if (countedRef.current) return;
    countedRef.current = true;

    const key = `blog:viewed:${slugOrId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 隐私模式等场景不可用则跳过会话去重 */
    }

    let cancelled = false;
    fetch(`/api/posts/${slugOrId}/views`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.viewCount != null) setCount(d.viewCount);
      })
      .catch(() => {
        /* 上报失败不影响阅读 */
      });
    return () => {
      cancelled = true;
    };
  }, [slugOrId]);

  return <span>{count} 阅读</span>;
}
