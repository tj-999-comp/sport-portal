# STG環境構築手順

## 方針

`query_learning_BB` の運用に合わせ、既存のCloudflare Pages project `sport-portal` に `stg` ブランチのPreview deploymentを追加する。ProductionのPages projectは新設しない。

| 項目 | Production | STG |
| --- | --- | --- |
| Pages project | `sport-portal` | `sport-portal` の `stg` Preview |
| URL（初期想定） | `https://sport-portal.pages.dev/` | `https://stg.sport-portal.pages.dev/` |
| Worker | `sport-portal-api` | `sport-portal-api-stg` |
| Worker設定 | `worker/wrangler.toml` | 同ファイルの `env.stg` |
| KV binding | `SPORTAL_DATA` | `SPORTAL_DATA` |
| KV namespace | 本番namespace | STG専用namespace |
| Secret | Production Secret | STG用Secret |
| 定期更新 | GitHub Actionsで1日5回 | GitHub Actionsで1日5回 |

実際に発行されたPreview URLが初期想定と異なる場合は、Cloudflare設定と `worker/wrangler.toml` の `env.stg.vars.APP_ORIGIN` を一致させる。

## リポジトリ側で準備済みの内容

- Worker名を `sport-portal-api-stg` に分離
- STG用の `SPORTAL_DATA` bindingを定義
- STG用KV namespace IDを設定
- STGの `APP_ORIGIN` を分離
- STGのCronを空配列にして、初期状態では自動取得しない構成に設定
- Production設定のKV ID、Worker名を変更していない

## Cloudflare設定が必要になる箇所

以下はCloudflareアカウントのリソース作成・Secret登録が必要なため、ローカル作業だけでは完了できない。

1. Cloudflare KVでSTG用namespaceを作成し、namespace IDを取得する。
2. `worker/wrangler.toml` のSTG用KV namespace IDが、作成したnamespaceのIDと一致することを確認する。
3. `npx wrangler deploy --env stg -c worker/wrangler.toml` でSTG Workerをデプロイする。
4. STG Workerへ次のSecretを登録する。値はIssueやGitへ記録しない。

   ```bash
   npx wrangler secret put BASIC_AUTH_USER --env stg -c worker/wrangler.toml
   npx wrangler secret put BASIC_AUTH_PASSWORD --env stg -c worker/wrangler.toml
   ```

5. PagesのPreview環境へ、`SPORTAL_API` のService Bindingとして `sport-portal-api-stg` を設定する。
6. PagesのPreview環境へ `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` をSecretとして登録する。
7. `stg` ブランチをPagesのPreview対象として設定し、Preview deploymentを生成する。

## Cloudflare設定後の確認

- STG URLが認証なしで401、正しい認証情報で200になる
- `/api/status`、`/api/data`、`/api/update` がSTG Workerへ到達する
- STG KVの対象リーグキー（`j1-2026`、`j2-2026`、`j3-2026`）だけが更新され、本番KVが変更されない
- `X-Robots-Tag: noindex`、robots.txt、HTTPSが有効である
- STG WorkerにCron Triggerが設定されておらず、Actionsが`SPORTAL_STG_API_URL`を参照している
- PagesのService Bindingが本番Workerではなく `sport-portal-api-stg` を指している

## STG受入チェック

本番反映前は、対象コミットとSTG URLを固定して、次の順番で確認結果を記録する。

1. 未認証でトップ、`/api/status`、`/api/data`、`/api/update` が401になる。
2. 認証後に `/`、`/j-league/`、`/design-review.html` が200になる。
3. `/api/status` が `success` または初回の空状態を返し、`/api/data` が画面表示に使えるJSONを返す。
4. 手動更新の成功、取得失敗時の前回データ保持、同時更新時の単一実行を確認する。
5. 日付選択、試合一覧の横移動、順位表、手動更新、トップへの戻る導線を確認する。
6. iPhone相当幅、iPad相当幅、PC幅のFirefoxで、横溢れ・直接URL・リロード・戻る操作を確認する。
7. `robots.txt`、HTMLのrobots meta、`X-Robots-Tag`、HTTPS、主要アセットの404なしを確認する。

確認記録には、対象コミット、確認URL、確認日時、確認者、結果、既知の制約だけを残す。認証情報、KVの実データ、Secret値は記録しない。

## 監視・障害対応

| 対象 | 確認方法 | 異常時の切り分け |
| --- | --- | --- |
| Pages | Deploymentsの対象PreviewがActiveか、主要URLのHTTP応答を確認 | Pagesの対象コミット、Functions、Preview Secret、Service Bindingを確認 |
| Worker | `sport-portal-api-stg` のVersion、Workersのエラー・リクエストを確認 | 認証、`APP_ORIGIN`、KV binding、取得元レスポンスを確認 |
| KV | STG namespaceの対象リーグキーと `update.status` を確認 | 本番namespaceとIDを照合し、STG側だけを再投入 |
| 定期更新 | `env.stg.triggers.crons = []` とActionsの接続先を確認 | `SPORTAL_STG_API_URL`、STG側の認証、Pages Service Bindingを確認 |

障害時は、まず認証・Pages→Worker Service Binding・Worker→STG KVの順に切り分ける。公式取得失敗だけの場合は、前回正常データを保持して失敗状態を確認する。

## 切り戻し・Secret更新・データ再投入

- PagesはDeploymentsから直前の成功Previewを再指定する。STGのブランチやProductionデプロイは変更しない。
- WorkerはVersion Historyから直前の成功Versionを再デプロイする。KV namespaceは削除しない。
- Secretを更新するときは、WorkerとPages Previewの両方を更新し、未認証401・認証後200を再確認する。
- 初期データを再投入するときは、対象リーグに対応するSTG KVキーだけを対象にし、`/api/status?league=...` と画面表示を確認する。
- 失敗時は対象コミット、CloudflareのVersion/Deployment、発生時刻、確認結果をIssueへ記録する。Secret値とKV実データは記録しない。

## 本番反映ルール

STG Previewの確認だけでは本番反映の承認とはみなさない。利用者の明示承認を得るまで、`main`への反映、本番デプロイ、Production Secret・KVの変更、関連Issueのクローズを行わない。

## 参照

- [本番公開手順](../DEPLOYMENT.md)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
