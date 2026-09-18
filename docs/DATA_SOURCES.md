# データ取得元と抽出方針

## 取得元

- 試合日程・結果:
  - J1: <https://www.jleague.jp/j1/match/search-list/?category=j1>
  - J2: <https://www.jleague.jp/j2/match/search-list/?category=j2>
  - J3: <https://www.jleague.jp/j3/match/search-list/?category=j3>
- 順位表:
  - J1: <https://www.jleague.jp/j1/standings/>
  - J2: <https://www.jleague.jp/j2/standings/>
  - J3: <https://www.jleague.jp/j3/standings/>

WorkerのAPIは `league=j1`、`league=j2`、`league=j3` をクエリで受け付ける。KVキーはリーグごとに `j1-2026`、`j2-2026`、`j3-2026` へ分離し、1リーグの取得失敗が他リーグのデータを上書きしない。

いずれもJリーグ公式サイトの各リーグページであり、別のデータ源へ切り替えない。Workerでは対象シーズンを `2026` に固定し、日程ページへ `startdate` と `enddate` を付与して取得する。

## 抽出

順位表はHTMLの表から、公式表示順の「勝点、試合数、勝、分、負、得点、失点、得失点差」を読み取り、画面の表示順へ変換する。チーム名は同じ公式行に含まれる省略名を正規化して保存する。

試合は、取得元にデータ属性付きのカードがある場合はカード属性を優先し、通常の公式試合リンクしかない場合は、日付見出し・節見出し・試合リンクの順序と公式チーム名から抽出する。終了、延期、中止、未開催は状態として保存し、ライブスコアは扱わない。

公式の検索結果には上限があるため、Workerは1月から12月まで月単位の12区間を取得し、試合ID相当の日時・対戦カード・キックオフで重複を除去する。これによりシーズン全体を取得しつつ、1回の検索結果上限を超えない。

## 変更時の確認

公式HTMLのページ構成が変わったら、`worker/test/index.test.js` に実際の断片を追加し、抽出失敗時は更新を保存しない。更新失敗時はKV内の前回データを保持し、画面には失敗状態だけを表示する。
