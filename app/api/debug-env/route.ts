/**
 * 一時的な診断 API ルート。
 * .env.local が Next.js から読まれているか確認する用途。
 *
 * 値そのものは返さず、設定有無と文字数だけ。動作確認後に削除してOK。
 */
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const EXPECTED_KEYS = [
  "NEXT_PUBLIC_AAD_CLIENT_ID",
  "NEXT_PUBLIC_AAD_TENANT_ID",
  "NEXT_PUBLIC_GRAPH_SITE_ID",
  "NEXT_PUBLIC_LIST_LEAVE_SNAPSHOTS",
  "NEXT_PUBLIC_LIST_LEAVE_RECORDS",
  "NEXT_PUBLIC_ADMIN_UPNS",
  "NEXT_PUBLIC_VIEWER_UPNS",
];

export async function GET() {
  const expected: Record<string, string> = {};
  for (const k of EXPECTED_KEYS) {
    const v = process.env[k];
    expected[k] = v
      ? `OK (length=${v.length}, head='${v.slice(0, 3)}...')`
      : "MISSING";
  }

  // 実際にロードされた NEXT_PUBLIC_* 一覧（タイポ検出用）
  const allFoundNextPublic = Object.keys(process.env)
    .filter((k) => k.startsWith("NEXT_PUBLIC_"))
    .sort();

  // .env.local を直接読んで「左辺の変数名」だけ抽出（値は出さない）
  const cwd = process.cwd();
  const envLocalPath = path.join(cwd, ".env.local");
  let envLocalDiag: {
    exists: boolean;
    size?: number;
    firstBytesHex?: string;
    variableNames?: string[];
    rawLineKinds?: Array<{ kind: string; charCount: number }>;
  };
  try {
    const stat = fs.statSync(envLocalPath);
    const buf = fs.readFileSync(envLocalPath);
    const firstBytesHex = Array.from(buf.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const text = buf.toString("utf-8");
    const variableNames: string[] = [];
    const rawLineKinds: Array<{ kind: string; charCount: number }> = [];
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/^﻿/, ""); // BOM除去
      const trimmed = line.trim();
      if (!trimmed) {
        rawLineKinds.push({ kind: "blank", charCount: rawLine.length });
        continue;
      }
      if (trimmed.startsWith("#")) {
        rawLineKinds.push({ kind: "comment", charCount: rawLine.length });
        continue;
      }
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) {
        rawLineKinds.push({ kind: "no-equals", charCount: rawLine.length });
        continue;
      }
      const name = trimmed.slice(0, eqIdx).trim();
      const valLen = trimmed.slice(eqIdx + 1).trim().length;
      variableNames.push(name);
      rawLineKinds.push({
        kind: valLen > 0 ? "assign" : "assign-empty",
        charCount: rawLine.length,
      });
    }
    envLocalDiag = {
      exists: true,
      size: stat.size,
      firstBytesHex,
      variableNames,
      rawLineKinds,
    };
  } catch (e) {
    envLocalDiag = { exists: false };
  }

  return NextResponse.json(
    {
      cwd,
      expected,
      allFoundNextPublic,
      envLocalDiag,
      hint:
        "envLocalDiag.variableNames に「NEXT_PUBLIC_AAD_CLIENT_ID」が含まれていなければ、変数名がそれと違う。" +
        "firstBytesHex が「ff fe」or「fe ff」なら UTF-16 BOM（メモ帳の保存形式問題）。「ef bb bf」は UTF-8 BOM（基本OK）。",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
