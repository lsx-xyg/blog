"use client";

import { useEffect, useState } from "react";

/** 浏览量：初始值来自服务端渲染，挂载后客户端上报 +1 */
export function ViewCounter({ initial, slugOrId }: { initial: number; slugOrId: string }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
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
