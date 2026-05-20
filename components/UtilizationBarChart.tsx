"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import type { LeaveRecord } from "@/lib/types";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  categorize,
  rankByUtilization,
  type UtilizationCategory,
} from "@/lib/domain/leaveMetrics";

interface Props {
  records: LeaveRecord[];
}

export function UtilizationBarChart({ records }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const topN = isMobile ? 5 : 10;
  const ranked = rankByUtilization(records.filter((r) => r.grantedDays > 0)).slice(
    0,
    topN,
  );
  const data = ranked.map((r) => ({
    name: r.name || r.employeeNo,
    rate: r.utilizationRate,
    category: categorize(r.utilizationRate),
  }));

  // Y軸の上限: 最大値を 10% 単位で切り上げ、最低 100%
  const maxRate = data.reduce((m, d) => Math.max(m, d.rate), 0);
  const yMax = Math.max(100, Math.ceil(maxRate / 10) * 10 + (maxRate % 10 === 0 ? 0 : 0));

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-4"
      aria-label="消化率ランキング"
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span aria-hidden>👥</span>
        <h2 className="text-sm font-semibold text-zinc-900">
          個人別 消化率ランキング (トップ {topN})
        </h2>
      </div>
      <div className="h-[360px] sm:h-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 16, bottom: 8, left: 4 }}
          >
            <XAxis
              dataKey="name"
              fontSize={11}
              interval={0}
              angle={isMobile ? -30 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 60 : 30}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={(v) => `${v}%`}
              fontSize={11}
              ticks={buildTicks(yMax, maxRate)}
            />
            <Tooltip
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "消化率"]}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={CATEGORY_COLOR[d.category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-700">
        {(["achieved", "ontrack", "behind"] as UtilizationCategory[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: CATEGORY_COLOR[c] }}
            />
            {CATEGORY_LABEL[c]}
          </span>
        ))}
      </div>
    </section>
  );
}

/**
 * Y軸の目盛: 0 / 30 / 60 / 90 / max（max > 100% の時はそれも表示）。
 */
function buildTicks(yMax: number, maxRate: number): number[] {
  const base = [0, 30, 60, 90];
  if (yMax > 100 && maxRate > 100) {
    return [...base, Math.round(maxRate * 10) / 10];
  }
  return [...base, 100];
}
