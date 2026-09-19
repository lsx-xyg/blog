"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Eye, Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 敏感信息二次验证弹窗（#18 方案 C：管理员密码验证）
 *
 * 点击「查看明文」时弹出，要求输入管理员密码，
 * 调后端 reveal API 验证通过后返回明文，由父组件展示。
 *
 * 安全：
 * - 明文不经过本组件持久化，仅在回调中传递给父组件临时展示
 * - 密码错误时显示错误提示，不泄露任何信息
 * - ESC / 遮罩点击 / 关闭按钮均可取消
 */
interface SecretRevealDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 字段展示名（如 "GitHub Token"） */
  fieldLabel: string;
  /** 字段 key（对应后端 SECRET_KEYS 白名单） */
  fieldKey: string;
  /** 取消回调 */
  onClose: () => void;
  /** 验证成功后回调（携带明文） */
  onRevealed: (value: string) => void;
}

export function SecretRevealDialog({
  open,
  fieldLabel,
  fieldKey,
  onClose,
  onRevealed,
}: SecretRevealDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noPassword, setNoPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时清空状态并聚焦密码框
  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setLoading(false);
      setNoPassword(false);
      // 延迟聚焦，等弹窗渲染完成
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ESC 键关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // 锁定背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fieldKey, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_PASSWORD") {
          setNoPassword(true);
          setLoading(false);
          return;
        }
        setError(data.error || "验证失败，请稍后重试");
        setLoading(false);
        return;
      }
      onRevealed(data.value as string);
      onClose();
    } catch {
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 图标和标题 */}
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">验证管理员身份</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              查看 <span className="font-medium text-foreground">{fieldLabel}</span> 的明文需要输入管理员密码，验证通过后临时展示 30 秒。
            </p>
          </div>
        </div>

        {/* 密码输入 / 无密码引导 */}
        {noPassword ? (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              当前账号未设置密码（通过 GitHub 登录创建）。请先在「账号设置」中设置密码，再使用明文查看功能。
            </p>
            <a
              href={`/${window.location.pathname.split("/")[1] || "dashboard"}/account`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              前往账号设置
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="mt-5">
            <label htmlFor="reveal-password" className="block text-sm font-medium mb-1.5">
              管理员密码
            </label>
            <input
              id="reveal-password"
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="请输入管理员登录密码"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* 按钮组 */}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          {!noPassword && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !password.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  验证中…
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  查看明文
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
