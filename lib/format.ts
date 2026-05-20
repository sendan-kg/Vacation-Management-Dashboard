/**
 * 表示用フォーマッタ。
 */

/**
 * "2025-09-01" → "2025/9/1" (PDF の表記に合わせて 0 埋めなし)
 */
export function formatJpDate(ymd: string): string {
  if (!ymd) return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
}
