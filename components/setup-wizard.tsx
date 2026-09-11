/**
 * 引导向导（client）：SETUP_SECRET 校验 → 密码注册 / GitHub 登录
 * 首个创建用户由 lib/auth.ts databaseHooks 自动置为 isAdmin
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SetupWizard({ needsSecret, adminPath }: { needsSecret: boolean; adminPath: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [secretOk, setSecretOk] = useState(!needsSecret);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verifySecret = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/setup-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!r.ok) throw new Error("密钥不正确");
      setSecretOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "验证失败");
    } finally {
      setBusy(false);
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: `/${adminPath}`,
        

      });
      if (error) throw new Error(error.message ?? "注册失败");
      router.push(`/${adminPath}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
      setBusy(false);
    }
  };

  const githubLogin = async () => {
    setBusy(true);
    setError("");
    await authClient.signIn.social({
      provider: "github",
      callbackURL: `/${adminPath}`,
        

    });
  };

  const input =
    "rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm outline-none focus:border-accent";
  const label = "text-xs font-medium text-fg-muted";

  if (!secretOk) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verifySecret();
        }}
        className="rounded-xl border border-border bg-surface p-6"
      >
        <label className={label}>安装密钥（SETUP_SECRET）</label>
        <input
          type="password"
          className={`${input} mt-1 w-full`}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoFocus
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "验证中…" : "验证密钥"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={signUp}
        className="rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="mb-4 text-sm font-semibold">创建管理员账号</h2>
        <div className="space-y-3">
          <div>
            <label className={label}>昵称</label>
            <input
              className={`${input} mt-1 w-full`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>邮箱</label>
            <input
              type="email"
              className={`${input} mt-1 w-full`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>密码</label>
            <input
              type="password"
              className={`${input} mt-1 w-full`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
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
          {busy ? "创建中…" : "创建账号"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-fg-faint">
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
