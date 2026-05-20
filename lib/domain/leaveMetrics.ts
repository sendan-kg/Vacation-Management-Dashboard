/**
 * KPI 集計ロジック。
 * Python `_workflows/leave-management-flow/make_leave_report.py` を TS に移植。
 */
import type { LeaveRecord, ParsedLeaveRecord } from "../types";

export interface LeaveKpi {
  staffCount: number;
  /** 付与あり職員（totalDays > 0）の数 */
  eligibleStaffCount: number;
  totalGrantedDays: number;
  totalUsedDays: number;
  overallUtilizationRate: number;
  /** 取得日数が 5 日未満の職員数（付与あり職員のみ母集団） */
  under5DaysCount: number;
  /** 消化率 100% 超の職員数 */
  overUtilizationCount: number;
  /** 消化率 0% の職員数 */
  zeroUtilizationCount: number;
}

type RecordLike = ParsedLeaveRecord | LeaveRecord;

export function computeKpi(records: RecordLike[]): LeaveKpi {
  const staffCount = records.length;
  const eligible = records.filter((r) => r.totalDays > 0);
  const totalGrantedDays = sum(records.map((r) => r.totalDays));
  const totalUsedDays = sum(records.map((r) => r.usedDays));
  const overallUtilizationRate =
    totalGrantedDays > 0 ? round1((totalUsedDays / totalGrantedDays) * 100) : 0;
  const under5DaysCount = eligible.filter((r) => r.usedDays < 5).length;
  const overUtilizationCount = records.filter((r) => r.utilizationRate > 100).length;
  const zeroUtilizationCount = eligible.filter((r) => r.usedDays === 0).length;
  return {
    staffCount,
    eligibleStaffCount: eligible.length,
    totalGrantedDays: round1(totalGrantedDays),
    totalUsedDays: round1(totalUsedDays),
    overallUtilizationRate,
    under5DaysCount,
    overUtilizationCount,
    zeroUtilizationCount,
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
 * 消化率に応じた色分けバケット。
 *  100% 超 = "over"
 *  90-100% = "high"
 *  60-90%  = "mid"
 *  30-60%  = "low"
 *  0-30%   = "danger"
 *  0%      = "zero"
 */
export type UtilizationBucket = "over" | "high" | "mid" | "low" | "danger" | "zero";

export function bucketize(rate: number): UtilizationBucket {
  if (rate > 100) return "over";
  if (rate >= 90) return "high";
  if (rate >= 60) return "mid";
  if (rate >= 30) return "low";
  if (rate > 0) return "danger";
  return "zero";
}

export function bucketColor(bucket: UtilizationBucket): string {
  switch (bucket) {
    case "over":
      return "#dc2626"; // rose-600
    case "high":
      return "#16a34a"; // green-600
    case "mid":
      return "#0284c7"; // sky-600
    case "low":
      return "#ca8a04"; // yellow-600
    case "danger":
      return "#ea580c"; // orange-600
    case "zero":
      return "#71717a"; // zinc-500
  }
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
