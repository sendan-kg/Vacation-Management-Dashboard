import type { LeaveRecord } from "@/lib/types";
import { formatJpDate } from "@/lib/format";
import { LABOR_LAW_GRANT_THRESHOLD } from "@/lib/domain/leaveMetrics";

interface Props {
  records: LeaveRecord[];
}

/**
 * 取得日数 5 日未満リスト。
 * 労働基準法の年5日取得義務（年10日以上付与の労働者対象）の確認用。
 * 母集団は「年10日以上付与」の職員のみ。週2-3勤務の比例付与者(<10日)は対象外。
 * 並び順は付与日昇順（早い職員＝期限が近い職員）。
 */
export function AlertList({ records }: Props) {
  const targets = records
    .filter(
      (r) => r.grantedDays >= LABOR_LAW_GRANT_THRESHOLD && r.usedDays < 5,
    )
    .sort((a, b) => {
      if (a.grantDate !== b.grantDate) return a.grantDate.localeCompare(b.grantDate);
      return a.employeeNo.localeCompare(b.employeeNo);
    });

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3"
      aria-label="取得日数5日未満リスト"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
          <span aria-hidden>⚠️</span>
          <span>取得日数5日未満リスト</span>
        </h2>
        <p className="text-xs text-zinc-600">
          労働基準法に基づく年5日の取得義務（年10日以上付与の労働者が対象）を満たしていない、またはペースが遅い職員のリストです。週2-3勤務の比例付与者は対象外。
        </p>
      </div>

      {targets.length === 0 ? (
        <p className="text-sm text-zinc-500 py-4 text-center">該当者はいません。</p>
      ) : (
        <ul className="space-y-2">
          {targets.map((r) => (
            <li
              key={r.itemId}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-zinc-900">{r.name}</div>
                <div className="mt-0.5 text-xs text-zinc-600">
                  {r.position || r.department || "ー"}
                  {r.grantDate && (
                    <>
                      <span className="mx-1.5 text-zinc-300">|</span>
                      付与日: {formatJpDate(r.grantDate)}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-rose-700 whitespace-nowrap">
                <div>消化: {fmtDays(r.usedDays)}</div>
                <div className="text-xs">残: {fmtDays(r.remainingDays)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function fmtDays(n: number): string {
  if (Number.isInteger(n)) return `${n}日`;
  return `${n.toFixed(1)}日`;
}
