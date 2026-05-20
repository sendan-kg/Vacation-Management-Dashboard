"use client";

import Link from "next/link";
import { useMsal } from "@azure/msal-react";

interface AppHeaderProps {
  displayName: string;
  isAdmin: boolean;
  /** 基準日 YYYY-MM-DD */
  referenceDate?: string;
}

export function AppHeader({ displayName, isAdmin, referenceDate }: AppHeaderProps) {
  const { instance } = useMsal();

  const handlePrint = () => window.print();
  const handleLogout = async () => {
    await instance.logoutRedirect();
  };

  return (
    <header className="no-print sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
            有給休暇消化率ダッシュボード
          </h1>
          {referenceDate && (
            <span className="text-xs sm:text-sm text-zinc-500">
              基準日: {referenceDate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700"
            >
              データ更新
            </Link>
          )}
          <button
            onClick={handlePrint}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            印刷 / PDF
          </button>
          <button
            onClick={handleLogout}
            className="hidden sm:block rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
            aria-label={`${displayName} としてサインイン中。サインアウト`}
            title={displayName}
          >
            サインアウト
          </button>
        </div>
      </div>
    </header>
  );
}
