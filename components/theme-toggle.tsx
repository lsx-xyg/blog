"use client";

import { useEffect, useRef, useState } from "react";
import { Laptop, Sun, Moon, Eye } from "lucide-react";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "跟随系统", icon: Laptop },
  { value: "light", label: "浅色系统", icon: Sun },
  { value: "dark", label: "深色系统", icon: Moon },
];

const WARM_OPTION: { value: ThemeMode; label: string; icon: typeof Sun } = {
  value: "warm",
  label: "护眼系统",
  icon: Eye,
};

/** 主题切换下拉菜单（对齐参考站 czhlove.cn）：
 * - 触发器展示 Laptop 图标（50x50）
 * - PC端 hover 即展示下拉菜单，移开自动关闭（150ms 延迟）
 * - 选项：跟随系统、浅色系统、深色系统、（分隔线）、护眼系统
 * - 激活项：文字加深 + 右侧蓝色点（不用对勾）
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

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleEnter = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const renderItem = (o: { value: ThemeMode; label: string; icon: typeof Sun }) => {
    const Icon = o.icon;
    const active = mode === o.value;
    return (
      <DropdownMenuItem
        key={o.value}
        onClick={() => select(o.value)}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={handleLeave}
        className={`flex items-center gap-2.5 cursor-pointer py-2.5 ${
          active ? "text-foreground font-medium" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{o.label}</span>
        {active && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
      </DropdownMenuItem>
    );
  };

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="relative group">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className="h-[50px] w-[50px] rounded-full hover:bg-accent flex items-center justify-center transition-colors"
          aria-label="选择主题"
        >
          <Laptop className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={handleLeave}
        >
          {OPTIONS.map(renderItem)}
          <DropdownMenuSeparator />
          {renderItem(WARM_OPTION)}
        </DropdownMenuContent>
      </DropdownMenu>
      {!open && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-50">
          选择主题
        </span>
      )}
    </div>
  );
}
