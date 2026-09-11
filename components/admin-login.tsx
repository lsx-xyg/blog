/**
 * 后台登录（client）：密码登录 / GitHub 登录
 * 账号关联（登录后绑定 GitHub）在 T10 设置页提供
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AdminLogin({ adminPath }: { adminPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: `/${adminPath}`,
    });
    if (error) {
      setError(error.message ?? "登录失败");
      setBusy(false);
    } else {
      router.push(`/${adminPath}`);
      router.refresh();
    }
  };

  const githubLogin = async () => {
    setBusy(true);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: `/${adminPath}`,
    });
  };

  const input =
    "rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm outline-none focus:border-accent";
  const label = "text-xs font-medium text-fg-muted";

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-xl font-semibold">后台登录</h1>
        <p className="mt-2 text-sm text-fg-muted">仅管理员可访问</p>
      </header>
      <form
        onSubmit={signIn}
        className="rounded-xl border border-border bg-surface p-6"
      >
        <div className="space-y-3">
          <div>
            <label className={label}>邮箱</label>
            <input
              type="email"
              className={`${input} mt-1 w-full`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className={label}>密码</label>
            <input
              type="password"
              className={`${input} mt-1 w-full`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "登录中…" : "密码登录"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-fg-faint">
        <span className="h-px flex-1 bg-border" />
        或
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={githubLogin}
        disabled={busy}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-strong disabled:opacity-50"
      >
        使用 GitHub 登录
      </button>
    </div>
  );
}
