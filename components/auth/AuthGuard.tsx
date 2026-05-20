"use client";

/**
 * 認証ガード + 管理者 UPN 照合。
 *
 * - `requireAdmin=true`: ADMIN_UPNS のみ通す（/admin で使う）
 * - `requireAdmin=false`: ADMIN_UPNS または VIEWER_UPNS を通す（/ で使う）
 *
 * 未認証ユーザーは自動で M365 サインインへリダイレクト。
 */
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import {
  BrowserAuthError,
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { graphTokenRequest, loginRequest } from "@/lib/msal-config";
import { isAdminEmail, isViewerOrAdminEmail } from "@/lib/env";

export interface AuthContextValue {
  email: string;
  displayName: string;
  isAdmin: boolean;
  token: string;
  refreshToken: () => Promise<string>;
}

interface AuthGuardProps {
  requireAdmin?: boolean;
  children: (ctx: AuthContextValue) => React.ReactNode;
}

export function AuthGuard({ requireAdmin = false, children }: AuthGuardProps) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "auth" | "ready" | "denied" | "error"
  >("idle");
  const loginTriggered = useRef(false);

  const acquireToken = useCallback(async (): Promise<string> => {
    const account = accounts[0] ?? instance.getActiveAccount();
    if (!account) throw new Error("No active account");
    try {
      const result = await instance.acquireTokenSilent({
        ...graphTokenRequest,
        account,
      });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect(graphTokenRequest);
        return "";
      }
      throw err;
    }
  }, [accounts, instance]);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    if (!isAuthenticated) {
      if (loginTriggered.current) return;
      loginTriggered.current = true;
      setPhase("auth");
      instance.loginRedirect(loginRequest).catch((e) => {
        if (
          e instanceof BrowserAuthError &&
          e.errorCode === "interaction_in_progress"
        ) {
          loginTriggered.current = false;
          return;
        }
        console.error(e);
        setError("ログインに失敗しました");
        setPhase("error");
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const t = await acquireToken();
        if (!t) return;
        const account = instance.getActiveAccount() ?? accounts[0];
        const userEmail = (account?.username ?? "").toLowerCase();
        const allowed = requireAdmin
          ? isAdminEmail(userEmail)
          : isViewerOrAdminEmail(userEmail);
        if (!allowed) {
          if (!cancelled) setPhase("denied");
          return;
        }
        if (cancelled) return;
        setToken(t);
        setEmail(userEmail);
        setDisplayName(account?.name ?? userEmail);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "認証エラー");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, acquireToken, instance, inProgress, accounts, requireAdmin]);

  if (phase === "ready" && token && email) {
    return (
      <>
        {children({
          email,
          displayName,
          isAdmin: isAdminEmail(email),
          token,
          refreshToken: acquireToken,
        })}
      </>
    );
  }

  if (phase === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-zinc-900">
            アクセス権がありません
          </h1>
          <p className="text-zinc-600 leading-relaxed">
            このダッシュボードへのアクセス権がありません。
            <br />
            園長または総務にご連絡ください。
          </p>
          <button
            onClick={async () => {
              await instance.logoutRedirect();
            }}
            className="rounded-full bg-zinc-900 px-6 py-3 text-white text-sm"
          >
            別のアカウントでサインイン
          </button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-rose-600">エラーが発生しました</h1>
          <p className="text-zinc-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-zinc-900 px-6 py-3 text-white text-sm"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-zinc-500">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
        <span className="text-sm">読み込み中…</span>
      </div>
    </div>
  );
}
