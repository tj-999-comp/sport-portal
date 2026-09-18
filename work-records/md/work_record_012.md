# 作業記録 012: J1・J2・J3のGitHub Actions定期更新を本番反映
作成日: 2026-09-18

## 概要

Issue #45（J-LEAGUE-01）として、J1・J2・J3のデータ取得・保存・API提供と、GitHub ActionsによるProduction/STGの時間トリガー更新を実装した。本番Workerを対応版へデプロイし、ProductionとSTGの各リーグ更新を確認したため、Issue #45をクローズした。

## 実施内容

- WorkerをJ1・J2・J3のリーグ設定、公式取得元、パーサー、KVキー（`j1-2026`、`j2-2026`、`j3-2026`）に対応させた。
- `/api/data`、`/api/status`、`/api/update`でリーグ指定を扱い、リーグ未指定時はJ1として動作する既存互換を維持した。
- 1リーグの取得失敗が他リーグへ影響しないよう、リーグ別の更新状態と前回データ保持を実装・テストした。
- Cloudflare WorkerのCron Triggerと`scheduled`イベントへの依存をなくし、GitHub ActionsのUTC `08:00 / 10:00 / 12:00 / 13:00 / 14:00`（JST `17:00 / 19:00 / 21:00 / 22:00 / 23:00`）へ移行した。
- GitHub ActionsにProduction/STG・全リーグまたは指定リーグを選べる`workflow_dispatch`を追加し、環境・リーグごとに独立して更新する構成にした。
- Production URL、STG URL、共通Basic認証SecretをGitHub Actionsから注入し、Secret値はログやリポジトリへ記録しない構成にした。

## 本番反映

- Production Worker `sport-portal-api`をJ1/J2/J3対応版へデプロイした。
- Worker Version ID: `5eef4e62-d4fa-4928-8ccd-a12f950842e8`
- 初回のProduction手動更新ではJ1のみ成功し、J2/J3が旧版Workerのため失敗した。対応版をデプロイ後に再実行し、J1/J2/J3すべての更新成功を確認した。
- Production更新: [GitHub Actions Run #35323376148](https://github.com/tj-999-comp/sport-portal/actions/runs/35323376148)
- STG更新: [GitHub Actions Run #35309996085](https://github.com/tj-999-comp/sport-portal/actions/runs/35309996085)

## 検証

- `npm test` 成功（22件）
- `npm run test:syntax` 成功
- Workflow YAML構文検証 成功
- `git diff --check` 成功
- PlaywrightでJ1→J2→J3のタブ切替、J2/J3データ表示、ArrowRight操作、ARIA選択状態、390px/1024px表示、コンソールエラーなしを確認した。
- STGのJ1/J2/J3更新APIを実行し、Productionデプロイ後にProductionのJ1/J2/J3更新APIを実行して全件成功を確認した。

## Issueの状態

- #45: クローズ。J1/J2/J3対応、GitHub Actions定期更新、STG検証、本番反映が完了。
- #43: クローズ済み。J1/J2/J3リーグタブとリーグ別表示のSTG受入完了。
- #44: オープン。テスト・ドキュメント・STG受入のIssue。実作業は完了しているため、状態整理が残っている。
- #42: オープン。J2・J3対応の親Issue。子Issueの状態整理後に完了判断する。

認証情報、Secret値、KVの実データは記録していない。
