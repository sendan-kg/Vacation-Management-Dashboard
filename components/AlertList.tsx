import type { LeaveRecord } from "@/lib/types";

interface Props {
  records: LeaveRecord[];
}

export function AlertList({ records }: Props) {
  const over = records.filter((r) => r.alertFlag === "100%超");
  const zero = records.filter((r) => r.alertFlag === "0%");

  if (over.length === 0 && zero.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">要注意リスト</h2>
        <p className="mt-2 text-sm text-zinc-500">該当者はいません。</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3"
      aria-label="要注意リスト"
    >
      <h2 className="text-sm font-semibold text-zinc-900">要注意リスト</h2>
      {over.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-700 mb-1">
            消化率 100% 超（{over.length}名）
          </div>
          <ul className="flex flex-wrap gap-2">
            {over.map((r) => (
              <li
                key={r.itemId}
                className="rounded-full bg-rose-100 text-rose-800 px-3 py-1 text-xs"
              >
                {r.name}
                <span className="ml-1 font-semibold">
                  {r.utilizationRate.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {zero.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-amber-700 mb-1">
            消化率 0%（{zero.length}名）
          </div>
          <ul className="flex flex-wrap gap-2">
            {zero.map((r) => (
              <li
                key={r.itemId}
                className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs"
              >
                {r.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
