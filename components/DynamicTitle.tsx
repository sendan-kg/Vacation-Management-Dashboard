"use client";

import { useEffect } from "react";

/**
 * ブラウザタブのタイトルを「有給休暇消化率ダッシュボードYYYYMMDD」に更新。
 * 基準日（YYYY-MM-DD）からハイフンを除去して付与する。
 */
export function DynamicTitle({ referenceDate }: { referenceDate?: string }) {
  useEffect(() => {
    if (!referenceDate) return;
    const ymd = referenceDate.replace(/-/g, "");
    document.title = `有給休暇消化率ダッシュボード${ymd}`;
  }, [referenceDate]);
  return null;
}
