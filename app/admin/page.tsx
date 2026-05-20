"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { InAppBrowserGuard } from "@/components/InAppBrowserGuard";
import { parseLeaveSnapshotBuffer } from "@/lib/xlsx/parseLeaveSnapshot";
import { computeKpi } from "@/lib/domain/leaveMetrics";
import {
  createRecords,
  createSnapshot,
  deleteSnapshotAndRecords,
  fetchSnapshotByDate,
  GraphError,
} from "@/lib/sharepoint";
import type { ParsedLeaveSnapshot } from "@/lib/types";

type UploadPhase =
  | "idle"
  | "parsing"
  | "preview"
  | "uploading"
  | "done"
  | "error";

export default function AdminPage() {
  return (
    <InAppBrowserGuard>
      <AuthGuard requireAdmin>
        {({ token, displayName }) => (
          <AdminUpload token={token} displayName={displayName} />
        )}
      </AuthGuard>
    </InAppBrowserGuard>
  );
}

function AdminUpload({
  token,
  displayName,
}: {
  token: string;
  displayName: string;
}) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [parsed, setParsed] = useState<ParsedLeaveSnapshot | null>(null);
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const handleFile = async (file: File) => {
    setError(null);
    setPhase("parsing");
    try {
      const buf = await file.arrayBuffer();
      const result = parseLeaveSnapshotBuffer(buf, file.name);
      if (result.records.length === 0) {
        throw new Error(
          "職員データが1件も見つかりませんでした。シート構造をご確認ください。",
        );
      }
      setParsed(result);
      setOverrideDate(result.referenceDate);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "パースに失敗しました");
      setPhase("error");
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setError(null);
    setPhase("uploading");

    const referenceDate = overrideDate || parsed.referenceDate;
    const kpi = computeKpi(parsed.records);

    try {
      // 同日 snapshot があれば削除（REPLACE）
      setProgress("既存スナップショットを確認しています…");
      const existing = await fetchSnapshotByDate(token, referenceDate);
      if (existing) {
        setProgress("既存のスナップショットを削除しています…");
        await deleteSnapshotAndRecords(token, existing.itemId);
      }

      // 新規 snapshot 作成
      setProgress("スナップショットを登録しています…");
      const snap = await createSnapshot(token, {
        referenceDate,
        filename: parsed.filename,
        uploadedByName: displayName,
        staffCount: parsed.records.length,
        overallUtilizationRate: kpi.overallUtilizationRate,
        totalGrantedDays: kpi.totalGrantedDays,
        totalUsedDays: kpi.totalUsedDays,
      });

      // 職員レコードを登録
      setProgress(`職員データを登録中… (0/${parsed.records.length})`);
      let i = 0;
      const chunk = 10;
      for (let start = 0; start < parsed.records.length; start += chunk) {
        const slice = parsed.records.slice(start, start + chunk);
        await createRecords(token, snap.itemId, slice);
        i += slice.length;
        setProgress(`職員データを登録中… (${i}/${parsed.records.length})`);
      }

      setProgress("");
      setPhase("done");
    } catch (e) {
      let msg: string;
      if (e instanceof GraphError) {
        msg = `${e.toUserMessage()}\n\n[詳細] status=${e.status}\n${e.body.slice(0, 500)}`;
      } else if (e instanceof Error) {
        msg = e.message;
      } else {
        msg = "アップロードに失敗しました";
      }
      setError(msg);
      setPhase("error");
    }
  };

  const handleReset = () => {
    setParsed(null);
    setOverrideDate("");
    setError(null);
    setProgress("");
    setPhase("idle");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-zinc-900">
            データ更新 — 有給休暇管理簿
          </h1>
          <Link
            href="/"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ダッシュボードへ戻る
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {phase === "idle" || phase === "parsing" || phase === "error" ? (
          <section className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm text-zinc-600 mb-4">
              「年次有給休暇管理簿（一覧）verX.X{"{YYYY-MM-DD}"}.xlsm」をアップロードしてください。
            </p>
            <label className="inline-block cursor-pointer rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
              {phase === "parsing" ? "解析中…" : "ファイルを選択"}
              <input
                type="file"
                accept=".xlsm,.xlsx"
                className="hidden"
                disabled={phase === "parsing"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            <p className="mt-3 text-xs text-zinc-400">
              ファイルはブラウザ上で解析され、SharePoint に保存されます。
            </p>
          </section>
        ) : null}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <pre className="whitespace-pre-wrap break-all font-sans">{error}</pre>
          </div>
        )}

        {phase === "preview" && parsed && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">
              アップロード内容を確認
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">ファイル名</dt>
                <dd className="font-mono text-xs text-zinc-900 break-all">
                  {parsed.filename}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">職員数</dt>
                <dd className="font-semibold text-zinc-900">
                  {parsed.records.length} 名
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500">基準日（必要なら変更可）</dt>
                <dd>
                  <input
                    type="date"
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </dd>
              </div>
            </dl>

            <details className="text-xs">
              <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900">
                プレビュー（先頭 5 名）
              </summary>
              <ul className="mt-2 space-y-1">
                {parsed.records.slice(0, 5).map((r) => (
                  <li key={r.employeeNo} className="text-zinc-700">
                    {r.employeeNo} / {r.name} — 付与 {r.totalDays.toFixed(1)} / 取得{" "}
                    {r.usedDays.toFixed(1)} ({r.utilizationRate.toFixed(1)}%)
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleReset}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                確定してアップロード
              </button>
            </div>
          </section>
        )}

        {phase === "uploading" && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-center space-y-3">
            <div className="size-8 mx-auto rounded-full border-2 border-zinc-300 border-t-indigo-600 animate-spin" />
            <p className="text-sm text-zinc-700">{progress}</p>
            <p className="text-xs text-zinc-400">
              数十秒かかります。閉じずにお待ちください。
            </p>
          </section>
        )}

        {phase === "done" && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-4">
            <h2 className="text-base font-bold text-emerald-900">
              アップロード完了
            </h2>
            <p className="text-sm text-emerald-800">
              ダッシュボードに反映されました。
            </p>
            <div className="flex justify-center gap-2">
              <Link
                href="/"
                className="rounded-full bg-emerald-700 px-6 py-2 text-sm font-semibold text-white"
              >
                ダッシュボードを開く
              </Link>
              <button
                onClick={handleReset}
                className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800"
              >
                別のファイルをアップロード
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
