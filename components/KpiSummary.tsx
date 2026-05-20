import type { LeaveKpi } from "@/lib/domain/leaveMetrics";

interface KpiSummaryProps {
  kpi: LeaveKpi;
}

export function KpiSummary({ kpi }: KpiSummaryProps) {
  return (
    <section
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      aria-label="サマリー"
    >
      <Card
        label="全体消化率"
        value={`${kpi.overallUtilizationRate.toFixed(1)}%`}
        sub={`${kpi.totalUsedDays.toFixed(1)} / ${kpi.totalGrantedDays.toFixed(1)} 日`}
        tone="primary"
      />
      <Card
        label="対象職員"
        value={`${kpi.eligibleStaffCount}名`}
        sub={`登録 ${kpi.staffCount}名のうち付与あり`}
        tone="muted"
      />
      <Card
        label="取得 5 日未満"
        value={`${kpi.under5DaysCount}名`}
        sub="付与あり職員のうち"
        tone={kpi.under5DaysCount > 0 ? "warning" : "muted"}
      />
      <Card
        label="要注意"
        value={`${kpi.overUtilizationCount + kpi.zeroUtilizationCount}名`}
        sub={`超過 ${kpi.overUtilizationCount} / 0% ${kpi.zeroUtilizationCount}`}
        tone={
          kpi.overUtilizationCount + kpi.zeroUtilizationCount > 0
            ? "danger"
            : "muted"
        }
      />
    </section>
  );
}

interface CardProps {
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "muted" | "warning" | "danger";
}

function Card({ label, value, sub, tone }: CardProps) {
  const toneClass = {
    primary: "border-indigo-200 bg-indigo-50",
    muted: "border-zinc-200 bg-white",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
  }[tone];
  const valueClass = {
    primary: "text-indigo-700",
    muted: "text-zinc-900",
    warning: "text-amber-700",
    danger: "text-rose-700",
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-xs text-zinc-600">{label}</div>
      <div className={`mt-1 text-2xl sm:text-3xl font-bold ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  );
}
