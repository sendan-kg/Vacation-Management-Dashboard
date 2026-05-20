"use client";

/**
 * 一時的な診断ページ。LeaveRecords List の現在の列一覧を表示。
 * GrantDate 列が作られているか確認用。動作確認後に削除してOK。
 */
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { env } from "@/lib/env";

interface ColumnInfo {
  name?: string;
  displayName?: string;
  type?: string;
  indexed?: boolean;
}

export default function DebugListPage() {
  return (
    <AuthGuard requireAdmin>
      {({ token }) => <DebugList token={token} />}
    </AuthGuard>
  );
}

function DebugList({ token }: { token: string }) {
  const [snapshotCols, setSnapshotCols] = useState<ColumnInfo[]>([]);
  const [recordCols, setRecordCols] = useState<ColumnInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        const fetchCols = async (listId: string) => {
          const url = `https://graph.microsoft.com/v1.0/sites/${env.graphSiteId}/lists/${listId}/columns?$top=200`;
          const res = await fetch(url, { headers });
          if (!res.ok) {
            throw new Error(
              `${res.status} ${await res.text().catch(() => "")}`,
            );
          }
          const data = await res.json();
          return (data.value ?? []).map((c: Record<string, unknown>) => ({
            name: c.name as string | undefined,
            displayName: c.displayName as string | undefined,
            type: detectType(c),
            indexed: c.indexed as boolean | undefined,
          }));
        };
        const [snap, rec] = await Promise.all([
          fetchCols(env.listIds.snapshots),
          fetchCols(env.listIds.records),
        ]);
        setSnapshotCols(snap);
        setRecordCols(rec);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen p-6 mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-bold">SharePoint List 列診断</h1>
      {err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 whitespace-pre-wrap break-all">
          {err}
        </div>
      )}
      <Section
        title="LeaveSnapshots"
        listId={env.listIds.snapshots}
        cols={snapshotCols}
      />
      <Section
        title="LeaveRecords"
        listId={env.listIds.records}
        cols={recordCols}
        highlight={["GrantDate"]}
      />
    </div>
  );
}

function Section({
  title,
  listId,
  cols,
  highlight = [],
}: {
  title: string;
  listId: string;
  cols: ColumnInfo[];
  highlight?: string[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <header className="px-4 py-3 border-b border-zinc-200">
        <h2 className="font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500 font-mono break-all">{listId}</p>
      </header>
      {cols.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500">読み込み中…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">name (internal)</th>
              <th className="px-3 py-2 text-left">displayName</th>
              <th className="px-3 py-2 text-left">type</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((c, i) => {
              const isHighlight = c.name && highlight.includes(c.name);
              return (
                <tr
                  key={i}
                  className={`border-t border-zinc-100 ${isHighlight ? "bg-amber-50" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.name}
                    {isHighlight && (
                      <span className="ml-2 text-amber-700">← 注目</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{c.displayName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{c.type}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function detectType(c: Record<string, unknown>): string {
  const types = [
    "text",
    "number",
    "boolean",
    "choice",
    "dateTime",
    "lookup",
    "personOrGroup",
    "calculated",
  ];
  for (const t of types) {
    if (c[t]) {
      if (t === "dateTime") {
        const dt = c[t] as Record<string, unknown>;
        return `dateTime (${dt.format ?? "?"})`;
      }
      return t;
    }
  }
  return "?";
}
