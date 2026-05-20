"use client";

import { useEffect, useState } from "react";

/**
 * Instagram / LINE / Facebook 等のアプリ内ブラウザ (IAB) を user-agent で検知。
 * Google OAuth が IAB を弾いて Google Cloud プロジェクトを停止させた経緯あり。
 *
 * IAB を検知したら、ログインボタンを隠して「標準ブラウザで開いてください」を表示。
 */
export function InAppBrowserGuard({ children }: { children: React.ReactNode }) {
  const [isIAB, setIsIAB] = useState<boolean | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    // 既知の IAB シグネチャ
    const iabPatterns = [
      /Instagram/i,
      /Line\//i,
      /FBAN|FBAV|FB_IAB/i,
      /Twitter/i,
      /KAKAOTALK/i,
    ];
    setIsIAB(iabPatterns.some((p) => p.test(ua)));
  }, []);

  if (isIAB === null) return null;

  if (isIAB) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold text-zinc-900">
            標準ブラウザで開いてください
          </h1>
          <p className="text-sm text-zinc-700 leading-relaxed">
            Instagram / LINE などのアプリ内ブラウザでは
            <br />
            Microsoft アカウントのサインインができません。
          </p>
          <p className="text-sm text-zinc-600">
            画面右上のメニューから
            <br />
            <strong>「ブラウザで開く」</strong>を選んで
            <br />
            Safari または Chrome で開き直してください。
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
