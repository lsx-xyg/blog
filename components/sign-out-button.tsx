"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-strong"
    >
      退出登录
    </button>
  );
}
