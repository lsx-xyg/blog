"use client";

import { useEffect, useState } from "react";

/**
 * 当前管理员账号是否已设置密码（客户端 Hook）
 *
 * 用于敏感信息「查看」按钮：纯 GitHub OAuth 创建的账号无密码，
 * 应直接引导去「账号设置」设置密码，而不是先弹密码输入框。
 * 加载失败时保守返回 true（有密码），由后端二次验证兜底。
 */
export function usePasswordStatus() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/account/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setHasPassword(d?.hasPassword ?? true);
      })
      .catch(() => {
        if (!cancelled) setHasPassword(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { hasPassword, checking: hasPassword === null };
}

/** 从当前 URL 推导后台路径（如 /dashboard/settings → dashboard） */
export function getAdminPathFromUrl() {
  if (typeof window === "undefined") return "dashboard";
  return window.location.pathname.split("/")[1] || "dashboard";
}
