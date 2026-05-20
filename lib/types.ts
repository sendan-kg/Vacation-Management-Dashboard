/**
 * SharePoint List のドメインモデル。
 */

export interface LeaveSnapshot {
  itemId: string;
  /** "2026-05-17" 形式の基準日文字列（= Title） */
  title: string;
  /** xlsm の TODAY() 基準日 */
  referenceDate: string;
  filename: string;
  uploadedByName: string;
  uploadedAt: string;
  staffCount: number;
  overallUtilizationRate: number;
  totalGrantedDays: number;
  totalUsedDays: number;
  etag?: string;
}

export interface LeaveRecord {
  itemId: string;
  snapshotItemId: string;
  employeeNo: string;
  name: string;
  department: string;
  position: string;
  grantedDays: number;
  carryoverDays: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  utilizationRate: number;
  alertFlag: AlertFlag;
}

export type AlertFlag = "100%超" | "0%" | "";

/**
 * xlsm パース → SharePoint 書込み前の中間モデル。
 */
export interface ParsedLeaveSnapshot {
  referenceDate: string;
  filename: string;
  records: ParsedLeaveRecord[];
}

export interface ParsedLeaveRecord {
  employeeNo: string;
  name: string;
  department: string;
  position: string;
  grantedDays: number;
  carryoverDays: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  utilizationRate: number;
  alertFlag: AlertFlag;
}
