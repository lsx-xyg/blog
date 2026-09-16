"use client";

/**
 * 通用管理端搜索框（C4·CRUD 骨架）
 *
 * 统一后台列表搜索交互：图标 + 输入 + 清除按钮 + focus 样式。
 * 宽度由调用方 className 控制（默认 w-full，紧凑场景传 w-32 sm:w-48 等）。
 */
import { Search, X } from "lucide-react";

export type AdminSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function AdminSearchInput({ value, onChange, placeholder, className = "" }: AdminSearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-8 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="清除搜索"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
