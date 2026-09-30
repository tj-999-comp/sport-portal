# NBAデータ取得・更新

## 提供元

2026-27 NBAの試合・順位データはAPI-SportsのNBA APIから取得する。試合一覧は `/games?league=standard&season=2026`、順位表は `/standings?league=standard&season=2026` を使う。APIキーはSTG Workerの `NBA_API_KEY` Secretに登録し、PagesやActionsへ複製しない。

API-Sportsは2026-27シーズン用のNBA APIガイドとゲーム・順位エンドポイントを公開している。無料プランは1日100リクエストで、全エンドポイントを利用できると案内されている。更新1回につき基本2リクエスト、STGで1日5回の場合は通常10リクエストを見込む。使用量はAPI-Sportsのダッシュボードで確認する。

API-Sportsの公開規約は、第三者データの公開に必要な許諾をAPI-Sportsが付与しないこと、NBAなど権利者が制限を課す場合は利用者が許諾を確認することを明記している。このため当面の目的は認証付きSTGでの技術評価に限り、公開利用の許諾確認が終わるまでProductionへ同データを出さない。

参照:

- [API-Sports 2026-27 NBAガイド](https://www.api-football.com/news/post/2026-2027-nba-season-guide-to-using-data-with-api-sports)
- [API-Sports NBA API](https://api-sports.io/sports/nba)
- [API-Sports API利用規約](https://api-sports.io/terms)

## データ検証

- NBA専用KVキー `nba-2026-27` に保存し、他競技のキーと分ける。
- 取得した試合に一意なID、開催日、両チーム、認識可能な試合状態がそろうことを確認する。時刻未定の試合では日付だけを保持する。
- 大会区分を判定できない試合は「大会区分未取得」として表示し、NBAの `standard` リーグ値や数値stageから推定しない。
- 順位APIが空の場合は順位を未取得として、日程を保存する。順位がある場合は東西それぞれ15チーム、順位、チーム名、勝敗がそろうことを確認する。
- API応答エラー、必須値の欠落、未知の試合状態、重複ID、取得途中の失敗では試合・順位を置き換えない。更新状態だけを失敗にし、前回の正常データを保持する。
- ライブ中は状態ラベルだけを表示する。スコアは終了状態の試合に限る。
- APIが値を返さない項目は推測せず、画面では `—` または「提供元から未取得」として扱う。公式発表待ちとは明確に区別する。

## 認証情報の登録

API-Sportsアカウントを用意し、DashboardからNBA API用キーを発行する。キーは値をチャット、Issue、Git、Actionsログへ出さず、次のコマンドでSTG Worker Secretとして登録する。

```bash
npx wrangler secret put NBA_API_KEY --env stg -c worker/wrangler.toml
```

認証情報を追加した後、STGの `/api/nba/update` を実行し、`/api/nba/status` と `/nba/` の表示を確認する。Production側へ同じ仕組みを適用するのは、STG受入後に明示承認を得てから行う。

## 更新Workflow

`.github/workflows/update-nba-data.yml` は毎日8、10、12、14、16時JSTにSTG NBAデータだけを更新する。GitHub Actions cronはUTCなので前日の23時、当日1時、3時、5時、7時とする。手動実行では環境を選ぶ。HTTP成功だけでなく、Workerが取得・検証・保存を完了し `update.status=success` を返すことを確認する。

## 既知のデータ制約

実APIキーによる2026-27応答をSTG受入時に検査する。API-Sportsの現行公開例では試合 `stage` が数値で返り、値と大会区分の対応表は公開ガイドから確認できない。実応答で確認するまで数値stageから大会区分を推定せず、取得失敗として前回データを維持する。また公開資料からはNBA Cupグループ表・進出情報、Play-In/プレーオフの公式ブラケット、順位表の進出記号を確認できていないため、対応が確認できない情報は画面で「提供元から未取得」と表示する。
