# 作業記録 019: NBAページ要件定義と実装Issue登録
作成日: 2026-09-30

## 概要

NBAページの2026-27シーズン要件を利用者との確認で確定し、要件書を作成した。実装に必要な工程を親Issue #62と5件の子Issueへ分割して登録した。あわせて、GitHub CLIに残っていた無効な認証情報を削除し、Gitのキーチェーン認証が引き続き有効であることを確認した。

## 確定したNBAページ要件

- 対象期間は2026年プレシーズン開始から2027年NBA Finals終了までの2026-27シーズンとする。
- Preseason、Regular Season、NBA Cup Group Play、NBA Cup Knockout、Play-In、Playoffs、NBA Finalsの日程・確定結果を対象にする。
- 表示日時はJST、チーム名はNBA公式の正式英語名とする。各試合に大会区分、開始時刻または公式状態、最終スコア、会場を表示する。
- 試合中の途中経過、選手・チーム詳細、ライブ配信リンク、通知、画像素材、ディビジョン別順位表、過去シーズン選択は対象外とした。
- 順位表は東西カンファレンスを縦に並べ、Rank、Team、W、L、WIN%、GB、CONF、HOME、ROAD、LAST 10、STREAK、公式の進出・敗退記号と凡例を表示する。
- モーダルには「順位表」「NBA Cup」「Play-In」「プレーオフ」の4タブを置く。NBA Cupは6組のグループ順位・公式進出状況・ノックアウトを表示し、Play-Inとプレーオフは公式の確定状況だけを表示する。
- NBA Cupのレギュラーシーズン成績算入は前年仕様を固定せず、対象シーズンのNBA公式ルールに従う。
- 手動更新は確認・進行中表示・二重実行防止を備え、自動更新はNBA専用Workflowで毎日8・10・12・14・16時JSTに行う。
- 取得元はNBA公式サイトおよび同サイトが公開利用するデータに限定し、未取得・公式未発表・取得失敗を区別する。取得失敗時は前回正常データを保持する。

要件全文は `docs/NBA_REQUIREMENTS.md` に記録した。実装、STG反映、本番反映はまだ行っていない。

## 登録したIssue

- 親Issue: [#62 NBA 2026-27 NBAページ実装](https://github.com/tj-999-comp/sport-portal/issues/62)
- [#66 Phase 1: 公式データ取得・保存・API・手動更新](https://github.com/tj-999-comp/sport-portal/issues/66)
- [#63 Phase 2: 日程・試合結果ページと手動更新UI](https://github.com/tj-999-comp/sport-portal/issues/63)
- [#65 Phase 3: 順位表・NBA Cup・Play-In・プレーオフのモーダル](https://github.com/tj-999-comp/sport-portal/issues/65)
- [#64 Phase 4: NBA専用の定期更新Workflow](https://github.com/tj-999-comp/sport-portal/issues/64)
- [#67 Phase 5: テスト・STG受入・運用ドキュメント整備](https://github.com/tj-999-comp/sport-portal/issues/67)

依存関係はPhase 1からPhase 2・3・4へ、Phase 1〜4からPhase 5へ設定した。親Issueには要件の概要、子Issue一覧、受入基準、NBA公式参照先を記載した。

## 認証情報の整理

- GitHub CLIが保持していた無効な認証情報をログアウト処理で削除した。
- GitHub CLI用のキーチェーン項目が削除済みであることを確認した。
- Gitの既存キーチェーン認証でGitHubリモートの読み取りが正常に動作することを確認した。
- トークン、パスワード、Secret値は確認・記録していない。
