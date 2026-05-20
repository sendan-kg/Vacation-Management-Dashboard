import type { LeaveKpi } from "@/lib/domain/leaveMetrics";

interface KpiSummaryProps {
  kpi: LeaveKpi;
}

export function KpiSummary({ kpi }: KpiSummaryProps) {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
      aria-label="サマリー"
    >
      <Card
        icon="📈"
        label="全体平均 消化率"
        value={`${kpi.overallUtilizationRate.toFixed(1)}`}
        unit="%"
        tone="primary"
      />
      <Card
        icon="🗒️"
        label="全体 消化日数 / 総付与日数"
        value={`${kpi.totalUsedDays.toFixed(1)} / ${kpi.totalGrantedDays.toFixed(0)}`}
        unit="日"
        tone="emerald"
      />
      <Card
        icon="⚠️"
        label="取得日数5日未満の職員"
        value={`${kpi.under5DaysCount}`}
        unit="名"
        tone="amber"
      />
    </section>
  );
}

interface CardProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  tone: "primary" | "emerald" | "amber";
}

function Card({ icon, label, value, unit, tone }: CardProps) {
  const toneClass = {
    primary: "border-indigo-200 bg-indigo-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
  }[tone];
  const iconBgClass = {
    primary: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 size-10 rounded-xl flex items-center justify-center text-lg ${iconBgClass}`}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-600 leading-tight">{label}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-zinc-900">
              {value}
            </span>
            <span className="text-sm text-zinc-600">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
