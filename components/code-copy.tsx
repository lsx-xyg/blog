"use client";

import { useEffect } from "react";

/**
 * 代码块复制按钮（T4 最小实现：挂载后向 .mdx-content 内所有 pre 注入按钮）
 * 不侵入 MDX 渲染树，避免与服务端渲染的 Shiki 输出冲突
 */
export function CodeCopy() {
  useEffect(() => {
    const root = document.querySelector(".mdx-content");
    if (!root) return;

    const pres = root.querySelectorAll("pre");
    pres.forEach((pre) => {
      if (pre.dataset.copyDone) return;
      pre.dataset.copyDone = "1";

      const btn = document.createElement("button");
      btn.textContent = "复制";
      btn.type = "button";
      btn.setAttribute(
        "aria-label",
        "复制代码",
      );
      btn.className =
        "absolute right-2 top-2 rounded-md border border-border bg-surface-strong px-2 py-0.5 font-mono text-xs text-fg-muted opacity-0 transition-opacity duration-150 hover:text-fg focus:opacity-100 group-hover:opacity-100";
      pre.classList.add("group", "relative");

      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code");
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code.textContent ?? "");
          btn.textContent = "已复制";
          setTimeout(() => (btn.textContent = "复制"), 1500);
        } catch {
          btn.textContent = "复制失败";
        }
      });

      pre.appendChild(btn);
    });
  }, []);

  return null;
}
