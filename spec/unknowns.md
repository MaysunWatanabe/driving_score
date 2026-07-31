# Unknowns — 仕様化にあたってコードからは確定できない事項

以下は既存コードを読んで判明した「仕様として書ききれない不明点／要ステークホルダー確認事項」の一覧です。ProjectSmith 取り込み前に確認してください。

## 1. 運転診断結果の共有範囲と第三者提供の可否
- **evidence**: `src/data/src/app/services/score-db.service.ts`, `src/data/android/app/src/main/AndroidManifest.xml`（package=`jp.co.nissan.drivingscore`）
- **impact**: high
- **question**: 本アプリで得られた運転診断結果・録画・センサーログは、本人以外にどの範囲まで共有・分析される想定ですか？(社内評価のみ / 研究用データセット化 / 家族への通知 など)
- **note**: 現状のコードにサーバー送信は無く、`Documents/driving-score/` 配下のローカル保存のみ。

## 2. 録画動画・センサーログの保持期間と削除ポリシー
- **evidence**: `src/data/src/app/driving/driving.page.ts`（movie.webm を追記書き込み）、`src/data/src/app/services/log.service.ts`（3MB/5MB でロテート）
- **impact**: high
- **question**: 録画映像とセンサーログの保持期間・自動削除条件・ユーザーが手動削除する UI の必要性はどう定義されていますか？
- **note**: 削除・世代管理・上限容量に関するコードは存在しない。

## 3. 自動ログイン有効期間の根拠 (72 時間 vs 3 日)
- **evidence**: `src/data/src/app/services/login.service.ts` — `Date.now() - (1000*60*60*24*3) <= loginData.timestamp`
- **impact**: medium
- **question**: 自動ログイン期限 (72 時間) の根拠と、共用端末や貸出車両で使う場合の運用ルールは何ですか？
- **note**: 定数化されていない。将来の変更影響とセキュリティ要件を確認したい。

## 4. スコアロジックの動的差し替えのガバナンス
- **evidence**: `src/data/src/app/data/score-logic.ts` の `new Function()` 動的評価、`src/data/src/app/settings/settings.page.ts` の openScoreLogicFile
- **impact**: high
- **question**: 運転診断ロジック (scoreLogic.txt / scoreLogic.json) の配布ワークフローと承認プロセスはどのようになっていますか？署名検証や配布経路の制限は必要ですか？
- **note**: 設定画面から任意のファイルを取り込んでアプリコンテキスト内で eval できるため、悪意ある差し替えのリスクがある。

## 5. スコア表示形式 (星 / 順位) を切替える意図
- **evidence**: `src/data/src/assets/data/scoreLogic.json` の settings.score_show_star.area1/2/3、`history.page.ts` / `comment.page.ts` の分岐
- **impact**: medium
- **question**: スコアの星表示と順位表示 (101-score) は誰向けに使い分ける前提ですか？ユーザー属性やモード切替のトリガ条件はありますか？

## 6. センサーモード (smartphoneOnly / canDataOnly / combination) の使い分け方針
- **evidence**: `src/data/src/app/settings/settings.page.ts`、`src/data/src/assets/data/scoreLogicFunction_simple.txt`、`src/scoreLogicFunction.js`
- **impact**: medium
- **question**: スマホのみ / CAN のみ / 併用モードは、どのような場面で使い分けを想定していますか？エンドユーザーが選ぶのか、車両で自動判定するのか？
- **note**: 現状はユーザー手動選択のみ。車両検知や車種による自動判定コードはない。

## 7. 能力指標 (scoreA=歩行, scoreB=注意, scoreC=視野) の医学的解釈
- **evidence**: `src/scoreLogicFunction.js`（駐車行動の正規分布スコア化）、`src/data/src/assets/data/scoreLogic.json`（labelA/B/C）、`src/data/src/app/history/history.page.ts`
- **impact**: high
- **question**: 能力指標 (scoreA/B/C) は誰にどんな意思決定に使ってもらう指標ですか？医学的レビューは受けていますか？

## 8. 対象交差点マスタが横浜みなとみらい周辺のみである理由
- **evidence**: `src/data/src/assets/data/scoreLogic.json` の intersection (5 交差点)
- **impact**: medium
- **question**: 現状の交差点マスタが横浜みなとみらい周辺のみである理由と、今後の対象エリア拡張方針は決まっていますか？

## 9. ヒヤリ判定閾値の根拠
- **evidence**: `src/scoreLogicFunction.js` の |Jerk_LPF|>0.4G/s、`scoreLogicFunction_simple.txt` の accel z<=-1.8 / gamma>=35
- **impact**: medium
- **question**: ヒヤリ / 減点判定のしきい値はどのような根拠 (実験 / 公的ガイドライン / 経験値) で決めていますか？車種や運転者ごとに変える運用はありますか？

## 10. Google Maps API キーの管理方針
- **evidence**: `src/data/src/environments/environment.ts`（`AIzaSyBx…`）、`src/data/android/app/src/main/AndroidManifest.xml`（`AIzaSyA8…`）
- **impact**: medium
- **question**: アプリに埋め込まれている Google Maps API キーは公開しても問題ないよう API 制限を掛けていますか？本番 / 検証で分ける必要はありますか？2 箇所で値が異なるのはなぜですか？

## 11. `CapabilityScore` コンストラクタでの scoreB/C 上書き (実装不具合の疑い)
- **evidence**: `src/data/src/app/data/score.ts:70-72`
  ```
  this.scoreA = capabilityScore.score.scoreA ?? -1;
  this.scoreB = capabilityScore.score.scoreA ?? -1;   // scoreA を代入
  this.scoreC = capabilityScore.score.scoreA ?? -1;   // scoreA を代入
  ```
- **impact**: medium
- **question**: `scoreB / scoreC` に `scoreA` を代入しているのは意図通りですか？(タイポと思われるが、実装 = 真実源として仕様化しているため確認したい)
- **note**: DB 経由の `makeDbCapabilityScore` は正しく `score_b / score_c` を代入するため、走行直後の Score のみで発症する。

## 12. `geolocation.json` (GPS デモ経路) の未接続
- **evidence**: `src/data/src/assets/data/geolocation.json` は存在するが、`SensorService` から読み込む処理が実装されていない
- **impact**: low
- **question**: `settings.gpsDemo=true` のとき、この JSON を再生する予定はありますか？設計書と実装の齟齬として保留にしていいですか？

## 13. `showConnectDialog` (BLE 複数選択) がキャンセル時に何もしない
- **evidence**: `src/data/src/app/data/ble.ts` の `showConnectDialog`
- **impact**: low
- **question**: BLE デバイス複数マッチ時のキャンセルで再スキャンや再ダイアログを提示しなくてもよいですか？(現状はログを出して閉じるだけ)

## 14. `WRITE_EXTERNAL_STORAGE` が AndroidManifest に未宣言
- **evidence**: `src/data/src/app/opening/opening.page.ts` で `requestPermission` を呼ぶが `AndroidManifest.xml` に宣言なし
- **impact**: low
- **question**: Android 12 以降で `requestLegacyExternalStorage=true` の運用を続ける前提ですか？将来 Android バージョンで動作しなくなる可能性があります。

## 15. `updateUser` の SQL インジェクションの疑い
- **evidence**: `src/data/src/app/services/user-db.service.ts` — `WHERE user_id = '${id}'` の直接連結
- **impact**: low (現行 UI では `^[a-zA-Z0-9]+$` で検証済)
- **question**: 将来 `user_id` の許容文字を広げる場合、プレースホルダに置換する対応が必要です。現状のバリデーションを恒久ルールとして採用する前提でよいですか？
