# 作業記録 005: Cloudflare本番公開とMVP受入準備
作成日: 2026-09-08

## 概要

スポーツポータルMVPをCloudflare Pages・Pages Functions・Workers・KVへ接続し、本番URLで認証付きのデータ表示と更新処理を確認した。実装系の子Issueを完了扱いにし、残っている端末別受入確認と公開設定確認を整理した。

## 実施内容

- Pages project `sport-portal`を `tj-999-comp/sport-portal` の`main`とGit連携し、本番デプロイを成功させた。
- PagesのService binding `SPORTAL_API`からWorker `sport-portal-api`へ`/api/*`を中継する構成を確認した。
- WorkerのKV binding `SPORTAL_DATA`を本番namespaceへ接続した。
- PagesとWorkerへBasic認証Secretを登録し、未認証時の`401`と認証後の画面表示を確認した。
- Cronを日本時間17:00、19:00、21:00、22:00、23:00の5本へ調整した。
- 本番で手動更新を実行し、試合399件・順位表20チームのデータ保存と「最新データを取得済み」の表示を確認した。
- `/api/status`の成功応答と、未認証APIの`401`を確認した。
- 公式サイトの現行HTMLに合わせて試合抽出を修正し、取得処理を直列化して本番更新時の接続数制限にも対応した。
- Workerのユニットテスト7件、`git diff --check`、作業記録の形式検証を実施した。

## クローズしたIssue

- [#4 MVP-03 データモデル・保存方式](https://github.com/tj-999-comp/sport-portal/issues/4)
- [#5 MVP-02 公式サイトの取得元・HTML構造調査](https://github.com/tj-999-comp/sport-portal/issues/5)
- [#8 MVP-01 プロジェクト基盤とCloudflare構成](https://github.com/tj-999-comp/sport-portal/issues/8)
- [#9 MVP-04 公式サイトからのデータ抽出](https://github.com/tj-999-comp/sport-portal/issues/9)
- [#10 MVP-05 更新処理・エラー時挙動](https://github.com/tj-999-comp/sport-portal/issues/10)
- [#11 MVP-09 順位表・更新操作UI](https://github.com/tj-999-comp/sport-portal/issues/11)

## 残作業・既知の制約

- 一時的に共有されたBasic認証情報は、Cloudflare上で利用者がローテーションする。
- iPhone・iPad・PC相当幅のFirefoxで、横スクロール、順位表モーダル、手動更新を最終確認する。
- 本番の`robots.txt`と`X-Robots-Tag: noindex`を最終確認する。
- 現行の実データでは節番号が`―`になるケースがあり、必要に応じて抽出器を追加修正する。
- 5本へ変更したため、6本を完了条件とする#12は未クローズ。#3、#6、#7、#13、#14および親Issue #2は、上記の受入確認後に判断する。

## 参照

- 公開URL: https://sport-portal.pages.dev/
- Pages project: `sport-portal`
- Worker: `sport-portal-api`
- KV key: `j1-2026`
- Cloudflare設定手順: [DEPLOYMENT.md](../../DEPLOYMENT.md)
