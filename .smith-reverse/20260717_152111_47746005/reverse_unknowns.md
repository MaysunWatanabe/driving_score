# Reverse Unknowns

## 運転診断データの共有範囲（個人用途か法人・研究用途か）

**description**: 全てのユーザー・スコアデータは端末内SQLiteに完結し、サーバー連携やアップロードAPIが存在しない。しかし詳細設計書には「TSC 石川」等の開発者名や『運転診断アプリ』という汎用名しかなく、成果物（スコア・動画・センサーログ）を誰が閲覧・活用する想定か（本人のみ／指導員／保険会社／研究者）が判断できない。

**evidence**: data/src/app/services/user-db.service.ts, data/src/app/services/score-db.service.ts, data/src/app/services/log.service.ts

**impact**: high

**suggested_question**: 運転診断の結果や録画動画・センサーログは、本人のみが確認するのか、他アクター（指導員・保険会社・研究機関）が回収して利用するのか。回収の方法（手動でファイル授受か、将来的にAPI連携か）を教えてください。


## スコアリング/コメントの数値定義・業務ルール

**description**: 実行時のスコア計算はscoreLogicKeyに保存されたJS本文と閾値JSONに完全に外注化されており、Angularアプリ側にはドメインルール（何が急加速/急ブレーキ/急ハンドルか、能力指標scoreA/B/C（筋力/柔軟性/視野の広さ）の判定基準）が存在しない。設定画面でロジック自体を差し替えられるため、ビジネス的な『正しさ』が仕様として不定。

**evidence**: data/src/app/data/score-logic.ts, data/src/assets/data/scoreLogicFunction.txt, data/src/assets/data/scoreLogic.json, scoreLogicFunction.js

**impact**: high

**suggested_question**: score1-4/scoreA-Cの評価軸は業務的に固定ですか、それとも運転診断ロジックの入れ替えを前提とした自由設計ですか。固定の場合、各スコアの意味（例：score1=アクセル）と閾値の正解値を明示してください。


## 自動ログイン期間72時間（コード上は3日）の妥当性

**description**: コードではDate.now() - 1000*60*60*24*3で自動ログインを許可しているが、詳細設計書には『前回ログイン時から72時間経過していなければ自動ログイン』とある。72時間という上限そのものがセキュリティ上妥当か、法人利用時に強制ログアウトポリシーが必要かは業務要件でしか決められない。

**evidence**: data/src/app/services/login.service.ts, .smith-reverse/20260717_152111_47746005/extracted/docs/運転診断アプリ_詳細設計書_20250228.xlsx.txt

**impact**: medium

**suggested_question**: 自動ログインの許容時間（72時間）は業務要件から決まった値ですか。運用によって短縮/延長する必要はありますか。


## スコアロジック配信の版管理・配布方針

**description**: assets/data/scoreLogicFunction.txt の先頭コメント`//<updatedAt>`と保存済みの値を比較して更新を上書きするため、初回起動または新版APK配布時に自動でロジックが差し替わる。しかし『誰がこの数値を管理するか（車両メーカー？TSC社？運用者？）』『ユーザーが編集した内容と衝突した場合の優先度』は仕様書に無い。

**evidence**: data/src/app/opening/opening.page.ts, data/src/app/settings/settings.page.ts

**impact**: medium

**suggested_question**: 運転診断ロジックの最新版はアプリバンドル同梱で配布する想定ですか？設定画面や外部ファイルで書き換えられた場合、次回起動時にどちらを優先すべきですか。


## 録画動画・ログの保持ポリシーと削除タイミング

**description**: 録画動画はDocuments/driving-score/data.<日付>/movie.webm等に、ログはlog.<日付>.txt.gzとして無期限で書き出される。アプリ内から削除UIは無く、ユーザーの端末容量が枯渇する可能性がある。加えて『どのくらい残すか』『個人情報保護観点からいつ消すか』が業務判断。

**evidence**: data/src/app/services/log.service.ts, data/src/app/driving/driving.page.ts

**impact**: high

**suggested_question**: 端末内に保存される録画動画とログの保持期間・削除ポリシーはどう規定しますか。ユーザー操作で消せる導線を追加する必要はありますか。


## BLEデバイス（DrivingCanData）の運用・調達方法

**description**: デバイス名'DrivingCanData'、固定サービスUUID 0x2310、固定デバイスID D8:3A:DD:6A:A2:15 が既知値としてハードコード。市販品か自社試作か、量産時に個別ペアリング手順を持つか等の運用モデルが不明。

**evidence**: data/src/app/data/ble.ts

**impact**: medium

**suggested_question**: BLE車載機は自社開発ですか、量販品ですか。デバイスIDの固定・複数台対応（選択ダイアログ実装済）はどのユースケースを想定していますか。


## デフォルト位置が神奈川県の座標である理由

**description**: SensorService.getLastLatLngのフォールバックは 35.4636, 139.6262（神奈川県横浜市付近）でハードコードされ、ScoreLogic.testScoreLogicのテスト座標も『けいゆう病院前交差点』となっている。開発現場に紐づいた値なのか、実運用時に別の値へ切り替える必要があるかがビジネス的な判断。

**evidence**: data/src/app/services/sensor.service.ts, data/src/app/data/score-logic.ts

**impact**: low

**suggested_question**: デフォルト位置座標(横浜)やテスト用の交差点は本番デプロイ後もそのままで良いですか。地域展開時に切り替え可能とすべきですか。

