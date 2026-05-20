# dashboard — 有給休暇消化率ダッシュボード エージェント向けガイド

> このディレクトリで作業するときは、本ファイルの指示と `~/.claude/plans/c-users-reon-sendan-kindergarten-hr-lea-velvet-papert.md` を参照すること。

## プロジェクト目的

認定こども園せんだん幼稚園の職員有給休暇消化状況をブラウザで可視化するダッシュボード。
Gemini 製の旧ダッシュボードからの移行プロジェクト（2026-05-20 着手）。

データソース: `hr/leave-management/年次有給休暇管理簿（一覧）verX.X{YYYY-MM-DD}.xlsm`
保存先: SharePoint Lists 2 種（LeaveSnapshots / LeaveRecords）
認証: Microsoft 365 SSO (MSAL.js, Azure AD アプリ `sendan-minutes-bot` を共有)

## 技術スタック

- **Next.js 16** App Router + TypeScript strict
- **Tailwind CSS v4**
- **@azure/msal-browser** + **@azure/msal-react**
- **recharts** v3 (棒グラフ)
- **xlsx (SheetJS)** v0.20 (xlsm パース)
- **Vercel** ホスティング（独立プロジェクト推奨、`leave-sendankg` 等）

## ファイル構成

```
hr/leave-management/dashboard/
├── app/
│   ├── layout.tsx                  # MSAL Provider ラッパ
│   ├── page.tsx                    # ダッシュボード本体
│   └── admin/page.tsx              # xlsm アップロード UI
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx        # MsalProvider
│   │   └── AuthGuard.tsx           # 管理者/閲覧者 UPN 照合
│   ├── AppHeader.tsx
│   ├── KpiSummary.tsx
│   ├── UtilizationBarChart.tsx
│   ├── StaffTable.tsx
│   ├── AlertList.tsx
│   ├── InAppBrowserGuard.tsx       # Instagram/LINE IAB 検知
│   └── DynamicTitle.tsx            # tab 名を「YYYYMMDD」付きに動的更新
├── lib/
│   ├── msal-config.ts
│   ├── env.ts                      # 環境変数 + isAdminEmail / isViewerOrAdminEmail
│   ├── types.ts
│   ├── sharepoint.ts               # Graph API CRUD ラッパ
│   ├── xlsx/parseLeaveSnapshot.ts
│   └── domain/leaveMetrics.ts      # KPI 計算 + 色分けバケット
├── scripts/
│   └── bootstrap_lists.py          # SharePoint List 2 種を作成
├── .env.example
└── package.json
```

## 初回セットアップ手順

1. **依存パッケージのインストール**
   ```powershell
   cd C:\Users\reon\sendan-kindergarten\hr\leave-management\dashboard
   npm install
   ```

2. **SharePoint List の構築**

   `shift-submission-flow/auth_setup.py` が完了済み（.env に `SHIFT_SP_SITE_ID` / `MS_GRAPH_REFRESH_TOKEN` がある）であることを確認したうえで:
   ```powershell
   python -X utf8 hr\leave-management\dashboard\scripts\bootstrap_lists.py
   ```
   出力された `NEXT_PUBLIC_GRAPH_SITE_ID` / `NEXT_PUBLIC_LIST_LEAVE_SNAPSHOTS` / `NEXT_PUBLIC_LIST_LEAVE_RECORDS` を控える。

3. **.env.local の作成**

   `.env.example` をコピーして以下を埋める:
   - `NEXT_PUBLIC_AAD_CLIENT_ID` / `NEXT_PUBLIC_AAD_TENANT_ID`: shift-submission-flow/web-app の `.env.local` と同じ値（sendan-minutes-bot 共有）
   - `NEXT_PUBLIC_GRAPH_SITE_ID` / `NEXT_PUBLIC_LIST_LEAVE_*`: bootstrap 出力
   - `NEXT_PUBLIC_ADMIN_UPNS`: reon の M365 UPN（CSV）
   - `NEXT_PUBLIC_VIEWER_UPNS`: 当面空でよい

4. **Azure AD アプリの SPA Redirect URI 追加**

   sendan-minutes-bot のアプリ登録 → 認証 → SPA に追加:
   - `http://localhost:3000` (開発用)
   - `https://leave-sendankg.vercel.app` (本番、Vercel デプロイ後)

5. **開発サーバ起動**
   ```powershell
   cd hr\leave-management\dashboard
   npm run dev
   ```
   http://localhost:3000 → 自動的に M365 ログイン → `/admin` で xlsm をアップロード → `/` で結果確認。

## 毎月の運用フロー

1. 月次締め日に `年次有給休暇管理簿（一覧）verX.X{YYYY-MM-DD}.xlsm` が更新される
2. reon がダッシュボードを開いて `/admin` に行く（管理者のみ表示されるボタン）
3. xlsm をアップロード → プレビュー確認 → 「確定してアップロード」
4. 同日 snapshot があれば REPLACE される（過去 snapshot は保持）
5. 印刷ボタンから PDF として保存 → Teams で職員に共有

## 設計上の注意

- **個人情報は SharePoint に閉じる**: 外部 API（Gemini 等）には送らない
- **データ取得はブラウザから直接 Graph API**: バックエンド不要。MSAL の SPA 認証で完結
- **同日 REPLACE 戦略**: 同じ基準日で2回アップロードしたら既存を削除して上書き
- **印刷用 CSS**: `.no-print` クラスでヘッダー・ボタン類を非表示。A4 縦設定
- **Next.js 16 破壊的変更**: API 変更点があるので、必要に応じて `node_modules/next/dist/docs/` 参照

## 残課題 (Phase別)

- P1 MVP: ✅ 完了（このコミット）
- P2 警告色分け: ✅ KpiSummary / AlertList / StaffTable で実装済
- P3 PDF出力: ✅ PrintButton + @media print
- P4 IAB対策 + 動的タイトル: ✅ InAppBrowserGuard + DynamicTitle
- P5 仕上げ: 過去 snapshot のドロップダウン履歴は未実装（必要なら追加）

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| ログイン直後に「アクセス権がありません」 | `NEXT_PUBLIC_ADMIN_UPNS` に自分の UPN が無い |
| Graph API 401 | アクセストークンの期限切れ。ページ再読み込み |
| Graph API 403 | sendan-minutes-bot に Sites.ReadWrite.All が無い、または SharePoint サイト権限不足 |
| xlsm パースが空 | シート名「年次有給休暇管理簿（一覧）」が変わっていないか確認 |
| 列がずれている | `lib/xlsx/parseLeaveSnapshot.ts` の `COL` 定数を実 xlsm に合わせ調整 |

## トリガーワード

「有給ダッシュボード」「有給休暇消化率」「有給ダッシュ更新」「leave-dashboard」
