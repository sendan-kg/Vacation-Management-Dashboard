"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import type { LeaveRecord } from "@/lib/types";
import { bucketColor, bucketize, rankByUtilization } from "@/lib/domain/leaveMetrics";

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
  const ranked = rankByUtilization(records.filter((r) => r.totalDays > 0)).slice(
    0,
    topN,
  );
  const data = ranked.map((r) => ({
    name: r.name || r.employeeNo,
    rate: r.utilizationRate,
    bucket: bucketize(r.utilizationRate),
  }));

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-4"
      aria-label="消化率ランキング"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          消化率ランキング（トップ {topN}）
        </h2>
        <span className="text-xs text-zinc-500">単位: %</span>
      </div>
      <div className="h-[320px] sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 32, bottom: 4, left: 24 }}
          >
            <XAxis
              type="number"
              domain={[0, "dataMax + 10"]}
              tickFormatter={(v) => `${v}%`}
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              fontSize={12}
              interval={0}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, "消化率"]}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={bucketColor(d.bucket)} />
              ))}
              <LabelList
                dataKey="rate"
                position="right"
                formatter={(v: number) => `${v.toFixed(1)}%`}
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
