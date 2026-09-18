# MVP公開手順

## 1. Pages

`app/` をCloudflare Pagesの静的出力ディレクトリとしてデプロイする。ビルドコマンドは不要、出力ディレクトリは `app`。リポジトリ直下の `functions/_middleware.js` をPages Functionsとして有効にし、Pages側にも同じ名前のSecret（`BASIC_AUTH_USER`、`BASIC_AUTH_PASSWORD`）を登録する。認証済みのPages応答には、middlewareから `X-Robots-Tag: noindex, nofollow, noarchive` などのプライバシーヘッダーを付与する。

Pages projectのService Bindingに `SPORTAL_API` という名前でWorker `sport-portal-api` を接続する。リポジトリ直下の `functions/api/[[path]].js` が `/api/*` をWorkerへ中継するため、`app/app.js` は相対パスの `/api/*` のままでよい。Pages Functionsのmiddlewareは静的ページ全体にBasic認証を適用し、Worker側でもAPIにBasic認証を適用する。

## 2. Workerと保存先

1. Cloudflare KV namespaceを作成し、`worker/wrangler.toml` の `[[kv_namespaces]]` に本番namespace IDを設定する。binding名は `SPORTAL_DATA` のままにする。
2. `worker` ディレクトリで `wrangler deploy -c wrangler.toml` を実行する。
3. Worker Secretを設定する。

```bash
wrangler secret put BASIC_AUTH_USER -c worker/wrangler.toml
wrangler secret put BASIC_AUTH_PASSWORD -c worker/wrangler.toml
```

認証情報はGit、Pagesの通常の環境変数、metadataへ保存しない。PagesとWorkerのSecretへ直接登録する。Pagesの静的HTMLをWorker経由で配信する場合は、Workerの静的アセット設定またはCloudflareのルーティングで、HTML・APIを含む全URLにBasic認証を適用すること。

## 3. GitHub Actionsによる定期更新

定期更新はCloudflare WorkerのCron Triggerではなく、`.github/workflows/update-league-data.yml` のGitHub Actionsで実行する。日本時間の `17:00 / 19:00 / 21:00 / 22:00 / 23:00` に対応するUTC `08:00 / 10:00 / 12:00 / 13:00 / 14:00` を設定し、各時刻にProductionとSTGのJ1/J2/J3へ独立した更新リクエストを送る。

リポジトリのActions設定に次を登録する。

- Variable `SPORTAL_API_URL`（またはSecret）: `/api`を含まない本番PagesのベースURL（例: `https://sport-portal.pages.dev`）
- Variable `SPORTAL_STG_API_URL`（またはSecret）: `/api`を含まないSTG PagesのベースURL（例: `https://stg.sport-portal.pages.dev`）
- Secret `SPORTAL_API_USER`: Worker/Pages Basic認証のユーザー名
- Secret `SPORTAL_API_PASSWORD`: Worker/Pages Basic認証のパスワード

ProductionとSTGで同じBasic認証情報を使う場合、ユーザー名・パスワードのActions Secretは共用できる。Actionsの `workflow_dispatch` では、対象環境（Production/STG/両方）と全リーグまたはJ1/J2/J3の組み合わせを選んで手動更新できる。本番・STGのWorkerではCron Triggerを空にする。

公式日程ページの検索結果上限（250件）を避けるため、試合日程は1〜12月の12区間に分けて取得し、重複を除いて結合する。更新に失敗した場合、試合・順位データは前回値を保持し、更新状態だけを `failure` としてKVへ保存する。

手動更新とActions更新が同じWorker isolate内で重なった場合は、リーグごとに実行中の更新処理を共有して二重取得を防ぐ。複数isolateをまたぐ強い排他制御はMVPの対象外で、必要になった場合はDurable Objects等の協調ロックを追加する。
