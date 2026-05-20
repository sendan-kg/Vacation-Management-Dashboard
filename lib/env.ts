/**
 * 環境変数の型付き取得。
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境変数 ${name} が未設定です`);
  }
  return value;
}

export const env = {
  aadClientId: required(
    "NEXT_PUBLIC_AAD_CLIENT_ID",
    process.env.NEXT_PUBLIC_AAD_CLIENT_ID,
  ),
  aadTenantId: required(
    "NEXT_PUBLIC_AAD_TENANT_ID",
    process.env.NEXT_PUBLIC_AAD_TENANT_ID,
  ),
  graphSiteId: required(
    "NEXT_PUBLIC_GRAPH_SITE_ID",
    process.env.NEXT_PUBLIC_GRAPH_SITE_ID,
  ),
  listIds: {
    snapshots: required(
      "NEXT_PUBLIC_LIST_LEAVE_SNAPSHOTS",
      process.env.NEXT_PUBLIC_LIST_LEAVE_SNAPSHOTS,
    ),
    records: required(
      "NEXT_PUBLIC_LIST_LEAVE_RECORDS",
      process.env.NEXT_PUBLIC_LIST_LEAVE_RECORDS,
    ),
  },
  /**
   * 管理者 UPN（CSV）。xlsm アップロード権限。
   * 閲覧者を増やしたい場合は viewerUpns を別途使う。
   */
  adminUpns: (process.env.NEXT_PUBLIC_ADMIN_UPNS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /**
   * 閲覧者 UPN（CSV）。管理者 UPN は自動的に含まれる扱い。
   * 空なら閲覧者ロールを無効化（= 管理者のみアクセス可）。
   */
  viewerUpns: (process.env.NEXT_PUBLIC_VIEWER_UPNS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /**
   * ダッシュボードから除外する社員番号（CSV）。
   * 管理者・システムアカウント等を集計から除く用途。
   * env 未設定なら ["901", "902"] がデフォルト。
   */
  excludedEmployeeNos:
    process.env.NEXT_PUBLIC_EXCLUDED_EMPLOYEE_NOS !== undefined
      ? process.env.NEXT_PUBLIC_EXCLUDED_EMPLOYEE_NOS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["901", "902"],
};

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminUpns.includes(email.toLowerCase());
}

export function isViewerOrAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (env.adminUpns.includes(e)) return true;
  if (env.viewerUpns.length === 0) return false;
  return env.viewerUpns.includes(e);
}
