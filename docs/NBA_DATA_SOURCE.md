# NBAデータ取得・更新

## 提供元

2026-27 NBAの試合日程・結果はBALLDONTLIE NBA APIのGames APIから取得する。Freeプランで利用でき、`Authorization` ヘッダーにAPIキーを指定する。APIキーはCloudflare Worker Secret `BALLDONTLIE_API_KEY` にだけ保存し、PagesやGitHub Actionsへ複製しない。Freeプランは1分あたり5リクエストまでなので、ページ取得間隔を12.5秒以上空ける。

対象は `season=2026` の `preseason`、`regular`、`ist`、`playin`、`playoffs`。Games APIは100件単位でカーソルページングする。日付フィルター（`dates[]`）で特定日の試合だけを再取得できる。

- [BALLDONTLIE NBA API](https://docs.balldontlie.io/)
- [プランと上限](https://www.balldontlie.io/account/)

## 取得頻度と保存

初回は全対象区分のシーズン日程を取得してKV `nba-2026-27` に保存する。以後の通常更新では、JSTで昨日・今日に当たる試合だけを取り直して、保存済み全日程の状態と結果を差し替える。将来分の日程はKVに残す。日程の変更を取り込むため、全日程は初回および7日ごとに再同期する。

更新時のAPI呼び出しは対象日がある区分だけに絞る。1つの更新内でも各リクエスト間を12.5秒以上空け、Freeプランの5回／分上限に余裕を持たせる。APIエラーや不完全データの場合は前回の正常な全日程を保持し、更新失敗状態だけを記録する。

## 提供されない情報

FreeプランのGames APIからは試合日程、状態、スコアを取得できる。Team Standings APIはGOATプラン限定である。また、Games APIからNBA Cupの順位・公式進出状況や、NBA Cup／Play-In／プレーオフの公式ブラケットは得られない。これらは試合結果から推測しない。会場情報も取得できない場合は表示しない。

## STG運用

NBA更新はSTG専用Workflowから毎日8・10・12・14・16時（JST）に実行する。本番Worker・本番KVへのNBA更新はこのWorkflowから行わない。手動更新と定期更新はいずれも `/api/nba/update` を使う。
