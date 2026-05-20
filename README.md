# 有給休暇消化率ダッシュボード

認定こども園せんだん幼稚園 職員の有給休暇消化状況を可視化するブラウザアプリ。

詳細は [CLAUDE.md](./CLAUDE.md) を参照。

## クイックスタート

```powershell
cd C:\Users\reon\sendan-kindergarten\hr\leave-management\dashboard
npm install
copy .env.example .env.local
# .env.local を編集 (CLAUDE.md セットアップ手順 参照)
python -X utf8 scripts\bootstrap_lists.py
npm run dev
```

http://localhost:3000 を開く。Microsoft 365 アカウントでログイン後、`/admin` から xlsm をアップロード。

## 機能

- ✅ Microsoft 365 SSO (MSAL)
- ✅ xlsm アップロード → SharePoint List 自動取込
- ✅ 全体消化率 / 取得日数 5日未満 / 100%超 / 0% の KPI 表示
- ✅ 消化率ランキング棒グラフ（PC top10 / モバイル top5）
- ✅ 全職員テーブル（ID順、色分け、要注意行を背景色で強調）
- ✅ 要注意リスト（100%超 / 0%）
- ✅ 印刷ボタン → ブラウザ印刷 → PDF
- ✅ Instagram / LINE 等のアプリ内ブラウザを検知してログインブロック
- ✅ 基準日に応じてタブタイトルを動的更新
