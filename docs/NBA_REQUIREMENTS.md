# 2026-27 NBAページ要件

## 対象

- `/nba/` に2026-27シーズンのプレシーズンからNBA Finalsまでの日程・結果を表示する。
- 過去シーズン選択と次シーズンへの自動切替は対象外。
- 日時はJST、チーム名は正式英語名で表示する。試合中の途中スコアは表示しない。
- 日付チップは試合のある日だけを過去から未来へ並べ、今日、次の開催日、最後の開催日の順で初期選択する。日付ボタンと横スワイプで切り替える。

## 順位・大会情報

- 下部シートに「順位表」「NBA Cup」「Play-In」「プレーオフ」の4タブを置く。
- 順位表は東西カンファレンスを縦に置き、Rank、Team、W、L、WIN%、GB、CONF、HOME、ROAD、LAST 10、STREAK、進出状況を表示する。Division表は作らない。
- NBA Cupはグループ順位・進出状況・ノックアウトを表示する。Play-Inとプレーオフは確定した対戦・予定・結果だけを表示する。
- 未取得、未発表、取得失敗を分ける。順位などから対戦や進出を推定しない。
- モーダルはEscape、背景、閉じるボタンで閉じられ、フォーカスを開いたボタンへ戻す。

## データ提供元と環境

当初評価していたAPI-SportsはFreeプランで2025・2026シーズンへアクセスできないため、BALLDONTLIE NBA Games APIに切り替える。Games APIはFreeプランで利用でき、認証ヘッダーは `Authorization`、APIキーはCloudflare Worker Secret `BALLDONTLIE_API_KEY` に置く。キーをブラウザーやGitHub Actionsへ複製しない。

BALLDONTLIE FreeプランはGames APIを1分あたり5回まで利用できる。Team StandingsはGOATプラン限定のため、Freeプランでは順位表を取得しない。NBA Cupの公式順位・進出情報や、Play-In／プレーオフの公式ブラケットもGames APIからは得られないため、試合結果から推測しない。

参照: [NBA API](https://docs.balldontlie.io/)、[アカウントプラン](https://www.balldontlie.io/account/)

## 更新・保全

- NBA専用KVキー `nba-2026-27` と `/api/nba/data`、`/api/nba/status`、`/api/nba/update` を使い、他競技のデータと分ける。
- 初回と7日ごとの更新では、シーズン全体の試合日程を取得して保存する。
- 通常の更新では、保存済み日程のうちJSTで昨日・今日に当たる試合だけを提供元へ再照会し、結果と状態を差し替える。全日程は画面表示用に保持する。
- Freeプランの上限を避けるため、1リクエストあたり最大100件とし、ページ取得間隔は12.5秒以上空ける。
- APIアクセスはBasic認証で保護する。同時更新は一つにまとめ、取得・検証・保存に失敗した場合は前回データを保つ。
- 自動更新Workflowは毎日8、10、12、14、16時JSTにSTGだけを更新する。Cloudflare Worker Cronは使わない。
- GitHub ActionsのScheduleとWorkflow Dispatchはデフォルトブランチ上のファイルが必要なため、`stg` ブランチ上のWorkflowはデフォルトブランチへ追加されるまで起動しない。STG受入までデフォルトブランチの更新は保留する。
- STG受入が終わるまで本番へ反映しない。
