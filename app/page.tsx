"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/AppHeader";
import { KpiSummary } from "@/components/KpiSummary";
import { UtilizationBarChart } from "@/components/UtilizationBarChart";
import { StaffTable } from "@/components/StaffTable";
import { AlertList } from "@/components/AlertList";
import { InAppBrowserGuard } from "@/components/InAppBrowserGuard";
import { DynamicTitle } from "@/components/DynamicTitle";
import {
  fetchLatestSnapshot,
  fetchRecordsBySnapshot,
  GraphError,
} from "@/lib/sharepoint";
import type { LeaveRecord, LeaveSnapshot } from "@/lib/types";
import { computeKpi, filterVisibleRecords } from "@/lib/domain/leaveMetrics";

export default function DashboardPage() {
  return (
    <InAppBrowserGuard>
      <AuthGuard>
        {({ token, isAdmin, displayName }) => (
          <Dashboard token={token} isAdmin={isAdmin} displayName={displayName} />
        )}
      </AuthGuard>
    </InAppBrowserGuard>
  );
}

function Dashboard({
  token,
  isAdmin,
  displayName,
}: {
  token: string;
  isAdmin: boolean;
  displayName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<LeaveSnapshot | null>(null);
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const snap = await fetchLatestSnapshot(token);
        if (cancelled) return;
        if (!snap) {
          setSnapshot(null);
          setRecords([]);
          return;
        }
        const recs = await fetchRecordsBySnapshot(token, snap.itemId);
        if (cancelled) return;
        setSnapshot(snap);
        setRecords(recs);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof GraphError
            ? e.toUserMessage()
            : e instanceof Error
              ? e.message
              : "データ取得に失敗しました";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // 管理者(901, 902 等)を除外してから全コンポーネントに渡す
  const visibleRecords = filterVisibleRecords(records);
  const kpi = computeKpi(visibleRecords);

  return (
    <div className="min-h-screen">
      <DynamicTitle referenceDate={snapshot?.referenceDate} />
      <AppHeader
        displayName={displayName}
        isAdmin={isAdmin}
        referenceDate={snapshot?.referenceDate}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loading && (
          <div className="text-sm text-zinc-500">読み込み中…</div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {!loading && !snapshot && (
          <EmptyState isAdmin={isAdmin} />
        )}
        {!loading && snapshot && visibleRecords.length > 0 && (
          <>
            <KpiSummary kpi={kpi} />
            <UtilizationBarChart records={visibleRecords} />
            <AlertList records={visibleRecords} />
            <StaffTable records={visibleRecords} />
            <footer className="no-print pt-4 text-xs text-zinc-400 text-center">
              データソース: {snapshot.filename} ／ 取込:{" "}
              {new Date(snapshot.uploadedAt).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-zinc-900">
        データがまだ登録されていません
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        最新の有給休暇管理簿（xlsm）をアップロードしてください。
      </p>
      {isAdmin && (
        <a
          href="/admin"
          className="mt-4 inline-block rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          データをアップロード
        </a>
      )}
    </div>
  );
}
