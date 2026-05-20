/**
 * xlsm パーサ。
 *
 * 想定ソース: `hr/leave-management/年次有給休暇管理簿（一覧）verX.X{YYYY-MM-DD}.xlsm`
 * メインシート: 「年次有給休暇管理簿（一覧）」
 *
 * 列構成（0-indexed）:
 *   0:No / 1:従業員番号 / 2:部門 / 3:役職 / 4:氏名 / 5:アラート / 6:取得日数
 *   8:雇入年月日（=付与日） / 11:合計日数 / 13:今年度付与日数 / 14:前年度繰越日数
 *
 * 行位置は固定せず、「社員番号が数値文字列の行」だけをデータとして拾う。
 * → 空行・ヘッダー（"従業員番号" 等）・タイトル行は自動でスキップされる。
 */
import * as XLSX from "xlsx";
import type {
  AlertFlag,
  ParsedLeaveRecord,
  ParsedLeaveSnapshot,
} from "../types";

const SHEET_NAME = "年次有給休暇管理簿（一覧）";

const COL = {
  no: 0,
  employeeNo: 1,
  department: 2,
  position: 3,
  name: 4,
  alert: 5,
  usedDays: 6,
  grantDate: 8,
  totalDays: 11,
  grantedDays: 13,
  carryoverDays: 14,
} as const;

export function parseLeaveSnapshotBuffer(
  buffer: ArrayBuffer,
  filename: string,
): ParsedLeaveSnapshot {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    throw new Error(`シート「${SHEET_NAME}」が見つかりません`);
  }
  // blankrows:true でシート行番号と配列 index を一致させ、全行を一律スキャン
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: true,
    defval: null,
  });

  const records: ParsedLeaveRecord[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r)) continue;

    const employeeNo = toStr(r[COL.employeeNo]);
    const name = toStr(r[COL.name]);

    // 社員番号が数値文字列でなければ非データ行 (タイトル/ヘッダー/空行) とみなしスキップ
    if (!employeeNo || !/^\d+$/.test(employeeNo)) continue;
    if (!name) continue;

    const usedDays = toNum(r[COL.usedDays]);
    const totalDays = toNum(r[COL.totalDays]);
    const grantedDays = toNum(r[COL.grantedDays]);
    const carryoverDays = toNum(r[COL.carryoverDays]);
    const remainingDays = Math.max(0, totalDays - usedDays);
    // 消化率は「今年度付与日数」を分母にする（合計ではない）
    const utilizationRate =
      grantedDays > 0 ? round1((usedDays / grantedDays) * 100) : 0;

    let alertFlag: AlertFlag = "";
    if (utilizationRate > 100) alertFlag = "100%超";
    else if (usedDays === 0 && grantedDays > 0) alertFlag = "0%";

    records.push({
      employeeNo,
      name,
      department: toStr(r[COL.department]),
      position: toStr(r[COL.position]),
      grantDate: toDateStr(r[COL.grantDate]),
      grantedDays: round1(grantedDays),
      carryoverDays: round1(carryoverDays),
      totalDays: round1(totalDays),
      usedDays: round1(usedDays),
      remainingDays: round1(remainingDays),
      utilizationRate,
      alertFlag,
    });
  }

  const referenceDate = extractReferenceDate(filename) ?? todayJst();

  return { referenceDate, filename, records };
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Excel の日付セルを "YYYY-MM-DD" に変換。
 * cellDates:true で読んだので Date オブジェクト or 文字列のどちらかが入る。
 */
function toDateStr(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(v);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) {
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * ファイル名から基準日（YYYY-MM-DD）を抽出。
 * 例: "年次有給休暇管理簿（一覧）ver1.12026-05-17.xlsm" → "2026-05-17"
 */
function extractReferenceDate(filename: string): string | null {
  const m = filename.match(/(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function todayJst(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
