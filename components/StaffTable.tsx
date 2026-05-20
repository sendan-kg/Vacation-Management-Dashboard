import type { LeaveRecord } from "@/lib/types";
import { bucketColor, bucketize } from "@/lib/domain/leaveMetrics";

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
      aria-label="職員別テーブル"
    >
      <div className="px-4 py-3 border-b border-zinc-200">
        <h2 className="text-sm font-semibold text-zinc-900">職員別一覧</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <Th>ID</Th>
              <Th align="left">氏名</Th>
              <Th align="left">部門</Th>
              <Th>付与</Th>
              <Th>繰越</Th>
              <Th>合計</Th>
              <Th>取得</Th>
              <Th>残</Th>
              <Th>消化率</Th>
              <Th>備考</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const bucket = bucketize(r.utilizationRate);
              const color = bucketColor(bucket);
              const rowTone =
                r.alertFlag === "100%超"
                  ? "bg-rose-50"
                  : r.alertFlag === "0%"
                    ? "bg-amber-50"
                    : "";
              return (
                <tr key={r.itemId} className={`border-t border-zinc-100 ${rowTone}`}>
                  <Td>{r.employeeNo}</Td>
                  <Td align="left" className="font-medium text-zinc-900">
                    {r.name}
                  </Td>
                  <Td align="left" className="text-zinc-600">
                    {r.department}
                  </Td>
                  <Td>{r.grantedDays.toFixed(1)}</Td>
                  <Td>{r.carryoverDays.toFixed(1)}</Td>
                  <Td>{r.totalDays.toFixed(1)}</Td>
                  <Td>{r.usedDays.toFixed(1)}</Td>
                  <Td>{r.remainingDays.toFixed(1)}</Td>
                  <Td>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {r.utilizationRate.toFixed(1)}%
                    </span>
                  </Td>
                  <Td className="text-xs">
                    {r.alertFlag && (
                      <span
                        className={
                          r.alertFlag === "100%超"
                            ? "text-rose-700 font-semibold"
                            : "text-amber-700 font-semibold"
                        }
                      >
                        {r.alertFlag}
                      </span>
                    )}
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

function Th({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <th className={`px-3 py-2 text-xs font-medium ${alignClass} whitespace-nowrap`}>
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
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <td className={`px-3 py-2 ${alignClass} whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}
