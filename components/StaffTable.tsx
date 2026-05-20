import type { LeaveRecord } from "@/lib/types";
import { CATEGORY_COLOR, categorize } from "@/lib/domain/leaveMetrics";
import { formatJpDate } from "@/lib/format";

interface Props {
  records: LeaveRecord[];
}

export function StaffTable({ records }: Props) {
  const sorted = [...records].sort((a, b) =>
    a.employeeNo.localeCompare(b.employeeNo),
  );
  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white"
      aria-label="職員別 詳細データ"
    >
      <div className="px-4 sm:px-5 py-3 border-b border-zinc-200">
        <h2 className="text-base font-semibold text-zinc-900">
          職員別 詳細データ
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <Th>社員ID</Th>
              <Th align="left">氏名</Th>
              <Th>付与日</Th>
              <Th>付与日数</Th>
              <Th>消化日数</Th>
              <Th>消化率</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const category = categorize(r.utilizationRate);
              return (
                <tr key={r.itemId} className="border-t border-zinc-100 hover:bg-zinc-50/50">
                  <Td className="text-indigo-600 font-medium">{r.employeeNo}</Td>
                  <Td align="left" className="font-semibold text-zinc-900">
                    {r.name}
                  </Td>
                  <Td className="text-zinc-700">
                    {r.grantDate ? formatJpDate(r.grantDate) : "ー"}
                  </Td>
                  <Td className="text-zinc-700">{fmtDays(r.grantedDays)}</Td>
                  <Td className="text-zinc-700">{fmtDays(r.usedDays)}</Td>
                  <Td>
                    <UtilizationBadge rate={r.utilizationRate} category={category} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UtilizationBadge({
  rate,
  category,
}: {
  rate: number;
  category: ReturnType<typeof categorize>;
}) {
  const color = CATEGORY_COLOR[category];
  const bgClass = {
    achieved: "bg-amber-50 text-amber-700 border-amber-200",
    ontrack: "bg-sky-50 text-sky-700 border-sky-200",
    behind: "bg-rose-50 text-rose-700 border-rose-200",
  }[category];
  const showCrown = category === "achieved";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${bgClass}`}
      style={{ borderColor: color }}
    >
      {showCrown && <span aria-hidden>👑</span>}
      {rate.toFixed(1)}%
    </span>
  );
}

function fmtDays(n: number): string {
  if (Number.isInteger(n)) return `${n}日`;
  return `${n.toFixed(1)}日`;
}

function Th({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const alignClass =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <th
      className={`px-4 py-3 text-xs font-medium ${alignClass} whitespace-nowrap`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "center",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignClass =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <td className={`px-4 py-3 ${alignClass} whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}
