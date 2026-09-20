"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  KeyRound,
  Loader2,
  Mail,
} from "lucide-react";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
const labelClass = "block text-sm font-medium mb-1.5";

/** 密码修改错误信息映射（better-auth 默认英文提示 → 中文） */
const PASSWORD_ERROR_MAP: Record<string, string> = {
  "invalid password": "当前密码错误",
  "password is too short": "新密码太短（至少 8 位）",
  "password does not match": "两次输入的新密码不一致",
};

/**
 * 账号设置（#18 延伸）：修改密码 + 关联 GitHub
 * - 修改密码：Better Auth changePassword（需验证当前密码）
 * - 关联 GitHub：Better Auth linkSocial（OAuth 授权跳转）
 * - 展示当前账号信息与已关联的登录方式
 */
export function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();

  // 已关联的登录方式（provider 列表）
  const [providers, setProviders] = useState<string[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  // 修改密码表单
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 关联 GitHub
  const [linking, setLinking] = useState(false);

  // 加载已关联的登录方式
  useEffect(() => {
    (async () => {
      try {
        const res = await authClient.listAccounts();
        if (!res.error && res.data) {
          setProviders(res.data.map((a) => a.providerId));
        }
      } catch {
        /* 静默 */
      } finally {
        setProvidersLoading(false);
      }
    })();
  }, []);

  const user = session?.user;
  const hasPassword = providers.includes("credential");
  const hasGithub = providers.includes("github");

  // 刷新已关联登录方式（设置密码成功后调用，切换为"修改密码"模式）
  const refreshProviders = async () => {
    try {
      const res = await authClient.listAccounts();
      if (!res.error && res.data) {
        setProviders(res.data.map((a) => a.providerId));
      }
    } catch {
      /* 静默 */
    }
  };

  const handleChangePassword = async () => {
    setMessage(null);
    // 无密码账号：首次设置密码，不需要当前密码（服务端 setPassword）
    if (!hasPassword) {
      if (newPassword.length < 8) {
        setMessage({ type: "error", text: "新密码至少 8 位" });
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage({ type: "error", text: "两次输入的新密码不一致" });
        return;
      }
      setPwLoading(true);
      try {
        const res = await fetch("/api/admin/account/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: data.error || "设置失败" });
        } else {
          setMessage({ type: "success", text: "密码设置成功，已可使用密码登录与二次验证" });
          setNewPassword("");
          setConfirmPassword("");
          await refreshProviders();
          // 新手引导：设置密码完成 → 通知 GuideManager 标记 completed
          try {
            window.dispatchEvent(new CustomEvent("guide:complete"));
          } catch {
            /* 无引导引擎时静默 */
          }
        }
      } catch {
        setMessage({ type: "error", text: "网络错误，请稍后重试" });
      } finally {
        setPwLoading(false);
      }
      return;
    }

    // 已有密码账号：修改密码，需验证当前密码
    if (!currentPassword) {
      setMessage({ type: "error", text: "请输入当前密码" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "新密码至少 8 位" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "两次输入的新密码不一致" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setMessage({
          type: "error",
          text: PASSWORD_ERROR_MAP[res.error.message ?? ""] ?? res.error.message ?? "修改失败",
        });
      } else {
        setMessage({ type: "success", text: "密码修改成功" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setPwLoading(false);
    }
  };

  const handleLinkGithub = async () => {
    setMessage(null);
    setLinking(true);
    try {
      const res = await authClient.linkSocial({
        provider: "github",
        callbackURL: window.location.href,
      });
      if (res.error) {
        setMessage({ type: "error", text: res.error.message ?? "关联失败" });
      } else if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setMessage({ type: "error", text: "关联失败，请重试" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setLinking(false);
    }
  };

  if (isPending || !user) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <div className="space-y-6">
      {/* 账号信息 */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">账号信息</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="font-medium text-foreground">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <KeyRound className="h-4 w-4" />
            <span>
              登录方式：
              {providersLoading ? (
                "加载中…"
              ) : (
                <span className="ml-1 flex flex-wrap gap-1.5">
                  {hasPassword && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">邮箱密码</span>
                  )}
                  {hasGithub && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">GitHub</span>
                  )}
                  {providers.length === 0 && (
                    <span className="text-muted-foreground">未知（可关联 GitHub）</span>
                  )}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 修改 / 设置密码 */}
      <div className="rounded-2xl border border-border bg-card p-6" data-guide="account-set-password">
        <h2 className="text-base font-semibold">{hasPassword ? "修改密码" : "设置密码"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasPassword
            ? "修改后其他设备上的登录会话将失效，需要重新登录。"
            : "当前账号没有密码（通过 GitHub 登录创建），设置密码后即可使用密码登录，并可启用敏感信息的密码二次验证。"}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {hasPassword && (
            <div className="sm:col-span-2">
              <label className={labelClass}>当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="请输入当前密码"
                autoComplete="current-password"
              />
            </div>
          )}
          <div>
            <label className={labelClass}>新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="至少 8 位"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelClass}>确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={handleChangePassword} disabled={pwLoading}>
            {pwLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中…
              </>
            ) : hasPassword ? (
              "修改密码"
            ) : (
              "设置密码"
            )}
          </Button>
        </div>
      </div>

      {/* 关联 GitHub */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">关联 GitHub</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasGithub
            ? "已关联 GitHub 账号，可直接使用 GitHub 登录。"
            : "关联后可使用 GitHub 一键登录，与邮箱密码账号按同邮箱自动绑定。"}
        </p>
        <div className="mt-4">
          {hasGithub ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              已关联
            </span>
          ) : (
            <Button type="button" variant="outline" onClick={handleLinkGithub} disabled={linking}>
              {linking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  跳转授权中…
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" />
                  关联 GitHub
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 提示信息 */}
      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-600/30 bg-green-600/5 text-green-700 dark:text-green-400"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
