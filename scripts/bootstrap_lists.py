"""有給休暇ダッシュボード用 SharePoint Lists を Graph API で構築するスクリプト。

LeaveSnapshots List + LeaveRecords List を作成する。
shift-submission-flow と同じ SharePoint サイトに同居させる方針。

前提:
  - shift-submission-flow の auth_setup.py で .env に MS_GRAPH_* が登録済み
  - SHIFT_SP_SITE_ID が .env にある（同じサイトを使う）

usage:
  python -X utf8 hr/leave-management/dashboard/scripts/bootstrap_lists.py
  python -X utf8 hr/leave-management/dashboard/scripts/bootstrap_lists.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
DASHBOARD_DIR = BASE_DIR.parent
ROOT_DIR = DASHBOARD_DIR.parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

# shift-submission の token refresh ヘルパを再利用
SHIFT_FLOW_DIR = ROOT_DIR / "_workflows" / "shift-submission-flow"
sys.path.insert(0, str(SHIFT_FLOW_DIR))
from sharepoint_shift_client import refresh_access_token, GRAPH_API_BASE  # noqa: E402

load_dotenv(ENV_PATH)


# ---------------------------------------------------------------------------
# スキーマ定義
# ---------------------------------------------------------------------------

LEAVE_SNAPSHOTS_NAME = "LeaveSnapshots"
LEAVE_RECORDS_NAME = "LeaveRecords"

SNAPSHOT_COLUMNS = [
    # Title は ReferenceDate と同値を入れる（"YYYY-MM-DD"）。displayName は「基準日」。
    {"name": "ReferenceDate", "label": "基準日(DateOnly)", "type": "DateTime",
     "displayFormat": "DateOnly", "required": True},
    {"name": "Filename", "label": "ファイル名", "type": "Text", "maxLength": 255},
    {"name": "UploadedByName", "label": "取込者", "type": "Text", "maxLength": 100},
    {"name": "UploadedAt", "label": "取込日時", "type": "DateTime"},
    {"name": "StaffCount", "label": "職員数", "type": "Number"},
    {"name": "OverallUtilizationRate", "label": "全体消化率(%)", "type": "Number", "decimal": 2},
    {"name": "TotalGrantedDays", "label": "全体付与日数", "type": "Number", "decimal": 1},
    {"name": "TotalUsedDays", "label": "全体取得日数", "type": "Number", "decimal": 1},
]

RECORD_COLUMNS = [
    # Title は従業員番号。displayName は「従業員番号」。
    {"name": "SnapshotLookup", "label": "スナップショット", "type": "Lookup",
     "lookupList": LEAVE_SNAPSHOTS_NAME, "lookupField": "Title", "required": True},
    {"name": "StaffName", "label": "氏名", "type": "Text", "maxLength": 100, "required": True},
    {"name": "Department", "label": "部門", "type": "Text", "maxLength": 100},
    {"name": "Position", "label": "役職", "type": "Text", "maxLength": 100},
    {"name": "GrantedDays", "label": "今年度付与日数", "type": "Number", "decimal": 1},
    {"name": "CarryoverDays", "label": "前年度繰越日数", "type": "Number", "decimal": 1},
    {"name": "TotalDays", "label": "合計日数", "type": "Number", "decimal": 1},
    {"name": "UsedDays", "label": "取得日数", "type": "Number", "decimal": 1},
    {"name": "RemainingDays", "label": "残日数", "type": "Number", "decimal": 1},
    {"name": "UtilizationRate", "label": "消化率(%)", "type": "Number", "decimal": 2},
    {"name": "AlertFlag", "label": "アラート", "type": "Choice",
     "choices": ["100%超", "0%", ""]},
]

TITLE_DISPLAY_NAME = {
    LEAVE_SNAPSHOTS_NAME: "基準日(YYYY-MM-DD)",
    LEAVE_RECORDS_NAME: "従業員番号",
}


# ---------------------------------------------------------------------------
# Graph API ヘルパ
# ---------------------------------------------------------------------------

class GraphError(RuntimeError):
    def __init__(self, status: int, text: str) -> None:
        super().__init__(f"Graph API {status}: {text[:400]}")
        self.status = status
        self.text = text


class GraphClient:
    def __init__(self, token: str) -> None:
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def get(self, path: str, params: dict | None = None) -> dict:
        url = f"{GRAPH_API_BASE}{path}" if path.startswith("/") else path
        r = requests.get(url, headers=self.headers, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: dict) -> dict:
        url = f"{GRAPH_API_BASE}{path}" if path.startswith("/") else path
        r = requests.post(url, headers=self.headers, json=body, timeout=30)
        if r.status_code >= 400:
            raise GraphError(r.status_code, r.text)
        return r.json() if r.text else {}

    def patch(self, path: str, body: dict) -> dict:
        url = f"{GRAPH_API_BASE}{path}" if path.startswith("/") else path
        r = requests.patch(url, headers=self.headers, json=body, timeout=30)
        if r.status_code >= 400:
            raise GraphError(r.status_code, r.text)
        return r.json() if r.text else {}


def column_payload(col: dict, lookup_list_ids: dict[str, str]) -> Optional[dict]:
    name = col["name"]
    payload: dict[str, Any] = {
        "name": name,
        "displayName": col.get("label", name),
        "required": bool(col.get("required", False)),
    }
    ctype = col["type"]
    if ctype == "Text":
        payload["text"] = {
            "allowMultipleLines": False,
            "appendChangesToExistingText": False,
            "linesForEditing": 0,
            "maxLength": col.get("maxLength", 255),
        }
    elif ctype == "Number":
        decimals = col.get("decimal", 0)
        payload["number"] = {
            "decimalPlaces": _decimal_label(decimals),
            "displayAs": "number",
        }
    elif ctype == "Choice":
        payload["choice"] = {
            "allowTextEntry": False,
            "displayAs": "dropDownMenu",
            "choices": col["choices"],
        }
    elif ctype == "DateTime":
        payload["dateTime"] = {
            "displayAs": "default",
            "format": "dateOnly" if col.get("displayFormat") == "DateOnly" else "dateTime",
        }
    elif ctype == "Lookup":
        target = col.get("lookupList")
        target_id = lookup_list_ids.get(target, "")
        if not target_id:
            print(f"   ! Lookup の参照先 '{target}' の List ID が未取得。スキップ", file=sys.stderr)
            return None
        payload["lookup"] = {
            "listId": target_id,
            "columnName": col.get("lookupField", "Title"),
        }
    else:
        print(f"   ! 未対応の列型: {ctype}", file=sys.stderr)
        return None
    return payload


def _decimal_label(n: int) -> str:
    if n <= 0:
        return "none"
    return {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}.get(n, "two")


def fetch_existing_lists(client: GraphClient, site_id: str) -> dict[str, dict]:
    res = client.get(f"/sites/{site_id}/lists",
                     params={"$top": 200, "$select": "id,displayName,name"})
    return {L["displayName"]: L for L in res.get("value", [])}


def create_list(client: GraphClient, site_id: str, name: str, description: str) -> dict:
    body = {
        "displayName": name,
        "description": description,
        "list": {"template": "genericList"},
    }
    return client.post(f"/sites/{site_id}/lists", body)


def fetch_columns(client: GraphClient, site_id: str, list_id: str) -> dict[str, dict]:
    res = client.get(f"/sites/{site_id}/lists/{list_id}/columns", params={"$top": 200})
    return {c.get("name"): c for c in res.get("value", [])}


def update_title_display_name(client: GraphClient, site_id: str, list_id: str,
                              new_name: str) -> None:
    cols = fetch_columns(client, site_id, list_id)
    title_col = cols.get("Title")
    if not title_col:
        return
    if title_col.get("displayName") == new_name:
        print(f"   - Title.displayName = '{new_name}' (既存)")
        return
    client.patch(
        f"/sites/{site_id}/lists/{list_id}/columns/{title_col['id']}",
        {"displayName": new_name},
    )
    print(f"   ~ Title.displayName -> '{new_name}'")


def add_column(client: GraphClient, site_id: str, list_id: str, payload: dict,
               existing: dict[str, dict]) -> None:
    name = payload["name"]
    if name in existing:
        print(f"   - {name}: (既存) スキップ")
        return
    try:
        client.post(f"/sites/{site_id}/lists/{list_id}/columns", payload)
        print(f"   + {name} '{payload.get('displayName')}'")
    except GraphError as e:
        print(f"   ! {name}: 作成失敗 — {e}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    site_id = os.environ.get("SHIFT_SP_SITE_ID") or os.environ.get("LEAVE_SP_SITE_ID")
    if not site_id:
        print("ERROR: .env に SHIFT_SP_SITE_ID も LEAVE_SP_SITE_ID も無い。"
              "shift-submission-flow/auth_setup.py を先に実行してください。",
              file=sys.stderr)
        return 1

    print(f"[bootstrap] site_id = {site_id}")
    if args.dry_run:
        print("[bootstrap] dry-run モード（実行しません）")
        return 0

    token = refresh_access_token()
    client = GraphClient(token)

    existing_lists = fetch_existing_lists(client, site_id)
    lookup_ids: dict[str, str] = {}

    # 1. LeaveSnapshots を作成
    for list_name, cols, desc in [
        (LEAVE_SNAPSHOTS_NAME, SNAPSHOT_COLUMNS, "有給休暇スナップショット（月次取り込み束）"),
        (LEAVE_RECORDS_NAME, RECORD_COLUMNS, "有給休暇 職員別レコード"),
    ]:
        print(f"\n=== {list_name} ===")
        if list_name in existing_lists:
            list_id = existing_lists[list_name]["id"]
            print(f"   - List (既存) id={list_id}")
        else:
            created = create_list(client, site_id, list_name, desc)
            list_id = created["id"]
            print(f"   + List 作成 id={list_id}")
        lookup_ids[list_name] = list_id

        # Title 列の displayName 変更
        update_title_display_name(client, site_id, list_id, TITLE_DISPLAY_NAME[list_name])

        # 列追加
        existing_cols = fetch_columns(client, site_id, list_id)
        for col in cols:
            payload = column_payload(col, lookup_ids)
            if payload is None:
                continue
            add_column(client, site_id, list_id, payload, existing_cols)

    print("\n=== .env.local に追加してください ===")
    print(f"NEXT_PUBLIC_GRAPH_SITE_ID={site_id}")
    print(f"NEXT_PUBLIC_LIST_LEAVE_SNAPSHOTS={lookup_ids[LEAVE_SNAPSHOTS_NAME]}")
    print(f"NEXT_PUBLIC_LIST_LEAVE_RECORDS={lookup_ids[LEAVE_RECORDS_NAME]}")
    print("\n[bootstrap] 完了")
    return 0


if __name__ == "__main__":
    sys.exit(main())
