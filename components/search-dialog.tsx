"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 搜索弹出对话框（对齐参考站 czhlove.cn）：
 * - 触发器只展示放大镜图标
 * - 点击后弹出居中搜索框，输入后按回车跳转到首页并带 ?q= 参数
 */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    if (!query.trim()) return;
    router.push(`/?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setQuery("");
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full hover:bg-accent"
        onClick={() => setOpen(true)}
        aria-label="搜索"
      >
        <Search className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* 透明遮罩：点击外部关闭，不显示半透明效果 */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={() => setOpen(false)}
      />
      {/* 搜索框 */}
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border bg-popover p-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="搜索文章…"
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setOpen(false)}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 px-2 text-xs text-muted-foreground">
          按 Enter 搜索 · Esc 关闭
        </div>
      </div>
    </div>
  );
}
