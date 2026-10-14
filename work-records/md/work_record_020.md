# 作業記録 020: NBAデータ取得元のBALLDONTLIE移行とSTG同期
作成日: 2026-10-12

## 概要

NBAデータ取得元をAPI-SportsからBALLDONTLIEへ切り替え、Freeプランのリクエスト上限を考慮したSTG更新処理を実装・反映した。STG Workerへシーズンデータを取り込み、データAPIと状態APIから取得成功を確認した。最終的なSTGフロントの目視確認は利用者が行う予定であり、本番環境への反映は行っていない。

## 背景と原因

- API-Sportsのキーでは2024シーズンの取得は成功した一方、2025・2026シーズンはFreeプラン対象外として拒否された。
- 利用者が確認したBALLDONTLIEのAPIレスポンスでは、2026年プレシーズンの確定試合とレギュラーシーズンの日程をHTTP 200で取得できていた。
- 実装ではAPIのベースURLに `/v1` が含まれる一方、絶対パス形式でURLを組み立てたため `/v1` が落ち、正しいエンドポイントへ到達しない問題も修正した。

## 実装内容

- NBAの取得処理をAPI-SportsからBALLDONTLIEへ切り替えた。
- 初回および週次はシーズン全体の日程を取得し、通常の日次更新はJSTの昨日・今日に該当する日付だけを取得して既存の全日程へマージする方式にした。日程変更頻度が低いことを前提に、定期取得量を抑える。
- Freeプランの制限に配慮し、ページあたり最大100件、リクエスト間隔12.5秒で取得するようにした。
- 取得元の表示、API設定、更新Workflow、運用ドキュメントをBALLDONTLIEに合わせた。更新WorkflowはSTGを対象とし、本番向けの更新は含めていない。
- 取得失敗時に既存の保存データを維持する運用を継続する。

## STG反映と確認

- STGブランチへ反映したコミット: `af985f7985b0affd18f99f5a8e2caf1fe4303b2c`
- STG Worker: `sport-portal-api-stg`
- デプロイ版: `25534907-684e-4cb3-b28e-69d960a63486`
- Worker URL: `https://sport-portal-api-stg.r9taji.workers.dev`
- 認証付きの手動初回更新がHTTP 200で完了し、2026-27シーズンの1,267試合を保存した。`update.status=success`、`refreshMode=full` を確認した。
- `/nba/`、`/api/nba/data`、`/api/nba/status` はHTTP 200を返し、保存データの取得元が `balldontlie`、`hasData=true`、更新状態がsuccessであることを確認した。
- 変更したNBAテスト4件は成功し、関連JavaScriptの構文確認も通過した。
- 利用者が最終的なSTGフロント表示を目視確認する。確認結果は本記録作成時点で未完了。

## 未完了事項と次セッションの予定

- GitHub ActionsのNBA定期更新WorkflowはSTGブランチにあるが、GitHubのscheduleやworkflow_dispatchで稼働させるにはデフォルトブランチ側のWorkflow設定が必要。今回、その有効化は行っていない。
- 次の別セッションでは、STGとPRDのソース、設定、データ保存先、Workflow、画面・API挙動を現行状態から確認し、環境間の差異を一覧化して埋める作業に移る予定。差異解消後にSTGで確認し、PRDへ反映する範囲と手順を判断する。
- この作業ではPRD Worker、Pages、Secret、KVの更新は行っていない。STGでの受入確認や明示的な本番反映指示より先にPRDへ反映しない。

## 関連情報

- BALLDONTLIE公式ドキュメント: https://docs.balldontlie.io/
- BALLDONTLIEプラン情報: https://www.balldontlie.io/account/

APIキー、パスワードなどの認証情報は記録していない。
