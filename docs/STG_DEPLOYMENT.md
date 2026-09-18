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
| Cron | 1日5回 | 初期は無効、手動更新のみ |

実際に発行されたPreview URLが初期想定と異なる場合は、Cloudflare設定と `worker/wrangler.toml` の `env.stg.vars.APP_ORIGIN` を一致させる。

## リポジトリ側で準備済みの内容

- Worker名を `sport-portal-api-stg` に分離
- STG用の `SPORTAL_DATA` bindingを定義
- STG用KV namespace IDを設定
- STGの `APP_ORIGIN` を分離
- STGのCronを空配列にして、初期状態では自動取得しない構成に設定
- Production設定のKV ID、Worker名、Cronを変更していない

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
- STG KVの `j1-2026` だけが更新され、本番KVが変更されない
- `X-Robots-Tag: noindex`、robots.txt、HTTPSが有効である
- STG WorkerにCron Triggerが設定されていない
- PagesのService Bindingが本番Workerではなく `sport-portal-api-stg` を指している

## 本番反映ルール

STG Previewの確認だけでは本番反映の承認とはみなさない。利用者の明示承認を得るまで、`main`への反映、本番デプロイ、Production Secret・KVの変更、関連Issueのクローズを行わない。

## 参照

- [本番公開手順](../DEPLOYMENT.md)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
