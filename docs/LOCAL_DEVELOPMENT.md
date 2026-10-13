# ローカル開発・再現手順

この手順では、Pages Functions、静的フロントエンド、Worker APIをローカルで起動する。WorkerのKVはWranglerのローカルシミュレーションを使うため、ProductionおよびSTGのKVには書き込まれない。

## 必要なもの

- Node.jsとnpm
- ターミナルとWebブラウザー
- NBAの更新処理も試す場合は、BALLDONTLIE APIキー

このリポジトリはアプリ依存パッケージを使わず、確認用コマンドにはNode.js組み込みのテストランナーを使う。Wranglerは `npx` で実行する。

```bash
node --version
npm --version
```

## リポジトリを用意する

```bash
git clone https://github.com/tj-999-comp/sport-portal.git
cd sport-portal
```

既にチェックアウト済みの場合は、リポジトリのルートで以降のコマンドを実行する。

## ローカル認証を設定する

PagesとWorkerの両方がBasic認証を使う。各ファイルに同じローカル専用の値を設定する。

リポジトリのルートに `.dev.vars` を作成する。

```dotenv
BASIC_AUTH_USER=local-user
BASIC_AUTH_PASSWORD=local-password
```

`worker/.dev.vars` も作成する。

```dotenv
BASIC_AUTH_USER=local-user
BASIC_AUTH_PASSWORD=local-password
# NBAの更新を試す場合だけ設定する
BALLDONTLIE_API_KEY=ここに自分のAPIキー
```

`.dev.vars*` はGitの対象外に設定している。実際の認証情報やAPIキーをIssue、ソースコード、通常の `.env` ファイルへ記録しない。

## PagesとWorkerを起動する

ターミナルを2つ開き、どちらもリポジトリのルートから実行する。

### ターミナル1: Worker API

```bash
npx wrangler dev --config worker/wrangler.toml --local --port 8787
```

初回はWranglerのダウンロード確認が表示される場合がある。続行後、Workerは `http://127.0.0.1:8787` で待ち受ける。

### ターミナル2: Pagesと画面

```bash
npx wrangler pages dev app --service SPORTAL_API=sport-portal-api --port 8788
```

Pages FunctionsはローカルWorkerを `SPORTAL_API` Service Binding経由で呼び出す。画面を `http://127.0.0.1:8788` で開き、認証ダイアログに `local-user` / `local-password` を入力する。

## 動作を確認する

ブラウザーで次の画面を確認する。

- `http://127.0.0.1:8788/` — トップ
- `http://127.0.0.1:8788/j-league/` — Jリーグ
- `http://127.0.0.1:8788/b-league/` — Bリーグ
- `http://127.0.0.1:8788/npb/` — NPB
- `http://127.0.0.1:8788/nba/` — NBA
- `http://127.0.0.1:8788/design-review.html` — デザイン確認ページ

ローカルAPIの応答も確認できる。

```bash
curl -i -u local-user:local-password 'http://127.0.0.1:8788/api/status?league=j1'
curl -i -u local-user:local-password 'http://127.0.0.1:8788/api/data?league=j1'
```

データがまだない場合は空のデータが返る。各画面の更新ボタンを押すと、Workerがデータ提供元へリクエストし、結果をローカルのKVシミュレーションへ保存する。データ更新を試すにはインターネット接続が必要。NBAの更新には `worker/.dev.vars` の `BALLDONTLIE_API_KEY` が必要である。データ提供元の応答や利用制限によって更新に失敗する場合もある。

アプリを使わず、既存の確認コマンドを直接実行することもできる。

```bash
npm test
npm run test:syntax
```

Wranglerを終了するときは、それぞれのターミナルで `Ctrl+C` を押す。

## よくある問題

| 症状 | 確認すること |
| --- | --- |
| 401または認証が繰り返し表示される | ルートの `.dev.vars` と `worker/.dev.vars` のユーザー名・パスワードが一致しているか確認する。変更後は両方のWranglerを再起動する。 |
| 画面は開くがAPIが503になる | Workerが先に起動しているか、Pagesコマンドの `SPORTAL_API=sport-portal-api` がWorker設定の名前と一致するか確認する。 |
| APIが502になる、更新に失敗する | データ提供元への接続、取得元ページの応答、NBAの場合はAPIキーを確認する。エラー内容は画面の更新状態またはWorker側ターミナルに表示される。 |
| ポートが既に使用されている | Wrangler起動時に別の空きポートを指定し、ブラウザーURLもそのポートに合わせる。 |
| `npx wrangler` が実行できない | Node.js/npmが使えるか確認し、ネットワーク接続後に再実行する。 |

## ローカルと外部環境の境界

- ローカルで画面、Pages Functions、Worker APIを起動できる。
- KVはWranglerのローカルシミュレーションを使用する。`--remote` を追加せず、Cloudflare上のProduction/STGリソースに接続しない。
- NBA以外のデータ更新も、Jリーグ、Bリーグ、NPBの各データ提供元へアクセスする。
- Cloudflareへのデプロイ、Pagesの設定、Production/STGのKV・Secret変更、GitHub Actionsの定期実行確認はこのローカル手順の対象外。これらは [`DEPLOYMENT.md`](../DEPLOYMENT.md) と [`STG_DEPLOYMENT.md`](STG_DEPLOYMENT.md) を参照する。

## 参考

- [Cloudflare Pagesのローカル開発](https://developers.cloudflare.com/pages/functions/local-development/)
- [Cloudflare PagesのService Bindingローカル開発](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Workersのローカル開発](https://developers.cloudflare.com/workers/local-development/)
