/**
 * Microsoft Graph API 経由で SharePoint Lists を CRUD するクライアント。
 * 2 List: LeaveSnapshots / LeaveRecords
 *
 * MSAL の access token を使ってブラウザから直接 Graph を叩く。
 */
import { env } from "./env";
import type {
  AlertFlag,
  LeaveRecord,
  LeaveSnapshot,
  ParsedLeaveRecord,
} from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type GraphFields = Record<string, unknown>;
type GraphItem = {
  id: string;
  fields: GraphFields;
  "@odata.etag"?: string;
};

interface ListResponse {
  value: GraphItem[];
  "@odata.nextLink"?: string;
}

export class GraphError extends Error {
  constructor(
    public status: number,
    public body: string,
    message: string,
  ) {
    super(message);
    this.name = "GraphError";
  }

  toUserMessage(): string {
    if (this.status === 403) {
      return "アクセス権限がありません。SharePoint への投稿権限が必要です。";
    }
    if (this.status === 401) {
      return "認証の有効期限が切れました。ページを再読み込みしてください。";
    }
    if (this.status === 429) {
      return "リクエスト回数が多すぎます。少し待ってから再度お試しください。";
    }
    if (this.status >= 500) {
      return "サーバーエラーが発生しました。少し待ってから再度お試しください。";
    }
    return `エラーが発生しました（${this.status}）`;
  }
}

function ymdToIsoJstNoon(ymd: string): string {
  return `${ymd}T03:00:00Z`;
}

function isoToYmdJst(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function graphFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GraphError(
      res.status,
      body,
      `Graph API ${res.status} ${path}: ${body.slice(0, 200)}`,
    );
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function listAllItems(
  listId: string,
  token: string,
  query: Record<string, string> = {},
): Promise<GraphItem[]> {
  const params = new URLSearchParams({
    $top: "500",
    $expand: "fields",
    ...query,
  });
  let url: string | undefined = `/sites/${env.graphSiteId}/lists/${listId}/items?${params}`;
  const items: GraphItem[] = [];
  while (url) {
    const data: ListResponse = await graphFetch<ListResponse>(url, token);
    items.push(...data.value);
    url = data["@odata.nextLink"];
  }
  return items;
}

// ---- マッパ -------------------------------------------------------------

function toSnapshot(it: GraphItem): LeaveSnapshot {
  const f = it.fields;
  return {
    itemId: it.id,
    title: String(f.Title ?? ""),
    referenceDate: f.ReferenceDate ? isoToYmdJst(String(f.ReferenceDate)) : "",
    filename: String(f.Filename ?? ""),
    uploadedByName: String(f.UploadedByName ?? ""),
    uploadedAt: String(f.UploadedAt ?? ""),
    staffCount: Number(f.StaffCount ?? 0),
    overallUtilizationRate: Number(f.OverallUtilizationRate ?? 0),
    totalGrantedDays: Number(f.TotalGrantedDays ?? 0),
    totalUsedDays: Number(f.TotalUsedDays ?? 0),
    etag: it["@odata.etag"],
  };
}

function toRecord(it: GraphItem): LeaveRecord {
  const f = it.fields;
  return {
    itemId: it.id,
    snapshotItemId: String(f.SnapshotLookupLookupId ?? f.SnapshotLookupId ?? ""),
    employeeNo: String(f.Title ?? ""),
    name: String(f.StaffName ?? ""),
    department: String(f.Department ?? ""),
    position: String(f.Position ?? ""),
    grantDate: f.GrantDate ? isoToYmdJst(String(f.GrantDate)) : "",
    grantedDays: Number(f.GrantedDays ?? 0),
    carryoverDays: Number(f.CarryoverDays ?? 0),
    totalDays: Number(f.TotalDays ?? 0),
    usedDays: Number(f.UsedDays ?? 0),
    remainingDays: Number(f.RemainingDays ?? 0),
    utilizationRate: Number(f.UtilizationRate ?? 0),
    alertFlag: (String(f.AlertFlag ?? "") as AlertFlag) || "",
  };
}

// ---- 公開 API -----------------------------------------------------------

/**
 * 最新のスナップショット（基準日が一番新しいもの）を取得。なければ null。
 */
export async function fetchLatestSnapshot(
  token: string,
): Promise<LeaveSnapshot | null> {
  const items = await listAllItems(env.listIds.snapshots, token, {
    $orderby: "fields/ReferenceDate desc",
    $top: "1",
  });
  if (items.length === 0) return null;
  return toSnapshot(items[0]);
}

export async function fetchAllSnapshots(
  token: string,
): Promise<LeaveSnapshot[]> {
  const items = await listAllItems(env.listIds.snapshots, token);
  return items
    .map(toSnapshot)
    .sort((a, b) => b.referenceDate.localeCompare(a.referenceDate));
}

export async function fetchSnapshotByDate(
  token: string,
  referenceDate: string,
): Promise<LeaveSnapshot | null> {
  const items = await listAllItems(env.listIds.snapshots, token, {
    $filter: `fields/Title eq '${referenceDate.replace(/'/g, "''")}'`,
  });
  if (items.length === 0) return null;
  return toSnapshot(items[0]);
}

export async function fetchRecordsBySnapshot(
  token: string,
  snapshotItemId: string,
): Promise<LeaveRecord[]> {
  const items = await listAllItems(env.listIds.records, token, {
    $filter: `fields/SnapshotLookupLookupId eq ${snapshotItemId}`,
  });
  return items
    .map(toRecord)
    .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo));
}

export interface CreateSnapshotInput {
  referenceDate: string;
  filename: string;
  uploadedByName: string;
  staffCount: number;
  overallUtilizationRate: number;
  totalGrantedDays: number;
  totalUsedDays: number;
}

export async function createSnapshot(
  token: string,
  input: CreateSnapshotInput,
): Promise<LeaveSnapshot> {
  const fields: GraphFields = {
    Title: input.referenceDate,
    ReferenceDate: ymdToIsoJstNoon(input.referenceDate),
    Filename: input.filename,
    UploadedByName: input.uploadedByName,
    UploadedAt: new Date().toISOString(),
    StaffCount: input.staffCount,
    OverallUtilizationRate: input.overallUtilizationRate,
    TotalGrantedDays: input.totalGrantedDays,
    TotalUsedDays: input.totalUsedDays,
  };
  const created = await graphFetch<GraphItem>(
    `/sites/${env.graphSiteId}/lists/${env.listIds.snapshots}/items`,
    token,
    { method: "POST", body: JSON.stringify({ fields }) },
  );
  return toSnapshot(created);
}

/**
 * レコードを500件単位でバッチ登録。
 * Graph API は1リクエスト1レコードしか受け付けないので、シリアルに連続 POST。
 * 43名程度なら数秒で完了する想定。
 */
export async function createRecords(
  token: string,
  snapshotItemId: string,
  records: ParsedLeaveRecord[],
): Promise<void> {
  for (const r of records) {
    const fields: GraphFields = {
      Title: r.employeeNo,
      SnapshotLookupLookupId: Number(snapshotItemId),
      StaffName: r.name,
      Department: r.department,
      Position: r.position,
      // 付与日: JST 正午で送ってタイムゾーンずれを防ぐ
      ...(r.grantDate ? { GrantDate: ymdToIsoJstNoon(r.grantDate) } : {}),
      GrantedDays: r.grantedDays,
      CarryoverDays: r.carryoverDays,
      TotalDays: r.totalDays,
      UsedDays: r.usedDays,
      RemainingDays: r.remainingDays,
      UtilizationRate: r.utilizationRate,
      AlertFlag: r.alertFlag,
    };
    await graphFetch<GraphItem>(
      `/sites/${env.graphSiteId}/lists/${env.listIds.records}/items`,
      token,
      { method: "POST", body: JSON.stringify({ fields }) },
    );
  }
}

/**
 * スナップショットと関連レコードを全削除（REPLACE 用）。
 */
export async function deleteSnapshotAndRecords(
  token: string,
  snapshotItemId: string,
): Promise<void> {
  // 関連レコードを先に削除
  const records = await fetchRecordsBySnapshot(token, snapshotItemId);
  for (const r of records) {
    await graphFetch<void>(
      `/sites/${env.graphSiteId}/lists/${env.listIds.records}/items/${r.itemId}`,
      token,
      { method: "DELETE" },
    );
  }
  // スナップショット本体を削除
  await graphFetch<void>(
    `/sites/${env.graphSiteId}/lists/${env.listIds.snapshots}/items/${snapshotItemId}`,
    token,
    { method: "DELETE" },
  );
}
