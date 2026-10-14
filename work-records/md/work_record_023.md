# 作業記録 023: 共通スコアレイアウトとリーグ別アセット整理のSTG反映
作成日: 2026-10-14

## 概要

Bリーグを起点に、NPB・NBAを含む共通スコアレイアウトを整理し、2桁と3桁の得点が混在する場合でも中央のスコア区切りがずれない表示へ調整した。あわせて、リーグ固有のJavaScript・CSSと共通パーツをディレクトリへ整理し、参照パス、構文チェック、テストを更新した。

STGブランチへfeatureブランチを統合してpushし、利用者によるSTG実機確認を完了した。確認後、`stg`から`main`へのPRを作成した。本番環境への直接反映やmainへのマージは行っていない。

## スコアレイアウトの変更

- `app/common/styles.css` にBリーグ・NPB・NBAで共有するスコアグリッドを整理した。
- Home/Awayのスコア列を3桁分の固定幅（`3ch`）にし、2桁と3桁の組み合わせでも中央の`score-divider`が中央からずれないようにした。
- スコア要素を列幅いっぱいにし、Home側を右寄せ、Away側を左寄せにした。
- スコアにtabular numeralsを適用し、数字幅の差による見た目の揺れを抑えた。
- Bリーグのチーム名ブロックをグリッド列いっぱいにして、Home側の右寄せ・Away側の左寄せを維持しながらチーム名の列を揃えた。
- NPB・NBAの固有CSS・マークアップを共通レイアウトに合わせ、NBAにはHome/Awayのスコア用クラスを追加した。

## ファイル構成と参照パスの整理

- 共通パーツを`app/common/`へ移動した。
  - `styles.css`
  - `sport-themes.css`
  - `header-nav.js`
- リーグ固有ファイルを各リーグディレクトリへ移動した。
  - `app/j-league/j-league.js`
  - `app/b-league/b-league.css`、`b-league.js`
  - `app/npb/npb.css`、`npb.js`
  - `app/nba/nba.css`、`nba.js`
- 各HTML、`DEPLOYMENT.md`、要件書、`package.json`、Workerテストの参照パスを更新した。
- 旧`app/styles.css`を削除し、共通CSSを`app/common/styles.css`へ統一した。

## STG反映と確認

- `feature/detail_fix_20261013`を`stg`へ統合したマージコミット: `4b429d9`
- スコア位置調整CSSの追加コミット: `e6c0278`
- `origin/stg`へのpushを完了した。
- 利用者がSTG環境で実機確認を行い、2桁・3桁得点時の中央位置とチーム名の整列を確認したうえで、今回の状態を正とした。
- STG URLは本セッションで提示されていないため、本記録には記載していない。

## PRと本番反映状態

- `stg`から`main`へのPRを作成した。
  - [PR #75: refactor: organize league assets and unify score layouts](https://github.com/tj-999-comp/sport-portal/pull/75)
- PR作成時のheadコミット: `e6c02784a170dc683f7222fb21a03df95c692b6e`
- PRは作成済み・未マージであり、mainおよび本番環境への反映は行っていない。

## 検証

- `npm run test:syntax`: 成功
- `git diff --check`: 成功
- `npm test`: 39件中38件成功、1件失敗
- 失敗したテストは、Jリーグページの`<option value="/">トップ</option>`を除外する既存期待値と、現行HTMLの内容が一致していないもの。今回の共通CSS・ファイル整理の検証とは別の既知の差異として残した。
- マージ競合は、共通パス・スコアレイアウト側をfeature、NBAのWorkflowと運用ドキュメント側をSTG専用設定として解消した。

認証情報、APIキー、パスワード、Secret値は記録していない。
