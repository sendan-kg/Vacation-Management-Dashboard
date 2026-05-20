/**
 * KPI 集計ロジック。
 * 消化率の分母は「今年度付与日数 (grantedDays)」を使う（合計ではない）。
 */
import { env } from "../env";
import type { LeaveRecord, ParsedLeaveRecord } from "../types";

/**
 * ダッシュボードから除外する社員番号（管理者・システム等）を除いたレコードを返す。
 * env.excludedEmployeeNos で制御。
 */
export function filterVisibleRecords<T extends LeaveRecord | ParsedLeaveRecord>(
  records: T[],
): T[] {
  const excluded = new Set(env.excludedEmployeeNos);
  return records.filter((r) => !excluded.has(r.employeeNo));
}

/**
 * 労基法の年5日取得義務の対象判定。
 * 年10日以上付与される労働者が対象 (週所定労働日数が少ない比例付与者は対象外)。
 */
export const LABOR_LAW_GRANT_THRESHOLD = 10;

export interface LeaveKpi {
  staffCount: number;
  /** 付与あり職員（grantedDays > 0）の数 */
  eligibleStaffCount: number;
  /** 全体付与日数 = 今年度付与日数の合計 */
  totalGrantedDays: number;
  totalUsedDays: number;
  overallUtilizationRate: number;
  /** 取得日数 5 日未満の職員数（年10日以上付与の労働者のみ母集団 = 労基法対象） */
  under5DaysCount: number;
}

type RecordLike = ParsedLeaveRecord | LeaveRecord;

export function computeKpi(records: RecordLike[]): LeaveKpi {
  const staffCount = records.length;
  const eligible = records.filter((r) => r.grantedDays > 0);
  const totalGrantedDays = sum(eligible.map((r) => r.grantedDays));
  const totalUsedDays = sum(records.map((r) => r.usedDays));
  const overallUtilizationRate =
    totalGrantedDays > 0 ? round1((totalUsedDays / totalGrantedDays) * 100) : 0;
  // 労基法の年5日取得義務は年10日以上付与の労働者が対象 (週2-3勤務の比例付与者は対象外)
  const under5DaysCount = eligible.filter(
    (r) => r.grantedDays >= LABOR_LAW_GRANT_THRESHOLD && r.usedDays < 5,
  ).length;
  return {
    staffCount,
    eligibleStaffCount: eligible.length,
    totalGrantedDays: round1(totalGrantedDays),
    totalUsedDays: round1(totalUsedDays),
    overallUtilizationRate,
    under5DaysCount,
  };
}

/**
 * 消化率ランキング（降順）。同率は氏名昇順。
 */
export function rankByUtilization<T extends RecordLike>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    if (a.utilizationRate !== b.utilizationRate) {
      return b.utilizationRate - a.utilizationRate;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * 消化率の3カテゴリ（参考資料の凡例に揃える）:
 *   "achieved" = 100% 達成（消化率 ≥ 100%）
 *   "ontrack"  = 消化率 30% 以上 100% 未満
 *   "behind"   = 消化率 30% 未満（要フォロー）
 */
export type UtilizationCategory = "achieved" | "ontrack" | "behind";

export function categorize(rate: number): UtilizationCategory {
  if (rate >= 100) return "achieved";
  if (rate >= 30) return "ontrack";
  return "behind";
}

export const CATEGORY_LABEL: Record<UtilizationCategory, string> = {
  achieved: "100%達成",
  ontrack: "消化率 30%以上",
  behind: "消化率 30%未満 (要フォロー)",
};

export const CATEGORY_COLOR: Record<UtilizationCategory, string> = {
  achieved: "#f59e0b", // amber-500 (PDFのオレンジ)
  ontrack: "#3b82f6", // blue-500 (PDFの青)
  behind: "#ef4444", // red-500 (PDFの赤、要フォロー)
};

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
