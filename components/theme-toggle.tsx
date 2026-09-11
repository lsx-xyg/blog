"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "sepia", label: "护眼" },
  { value: "system", label: "跟随系统" },
];

/** 四主题切换（浅色/深色/护眼/跟随系统，localStorage 记忆 + 防 FOUC） */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMode(getStoredTheme());
  }, []);

  const select = (m: ThemeMode) => {
    setMode(m);
    applyTheme(m);
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => select(o.value)}
          className={`rounded-full px-2.5 py-1 transition ${
            mode === o.value
              ? "bg-fg text-bg"
              : "text-fg-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
