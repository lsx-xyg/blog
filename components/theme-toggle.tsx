"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Sun, Moon, Eye, Check } from "lucide-react";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "warm", label: "护眼", icon: Eye },
  { value: "system", label: "跟随系统", icon: Monitor },
];

/** 主题切换下拉菜单（对齐参考站 czhlove.cn）：
 * - 触发器只展示显示器图标（50x50）
 * - PC端 hover 即展示下拉菜单（无需点击），带延迟关闭避免抖动
 * - 下拉菜单四个选项（浅色/深色/护眼/跟随系统），当前选中有对勾
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMode(getStoredTheme());
  }, []);

  const select = (m: ThemeMode) => {
    setMode(m);
    applyTheme(m);
    setOpen(false);
  };

  const handleEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="h-[50px] w-[50px] rounded-full hover:bg-accent"
            aria-label="切换主题"
          >
            <Monitor className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <DropdownMenuItem
                key={o.value}
                onClick={() => select(o.value)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{o.label}</span>
                {mode === o.value && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
