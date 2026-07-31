# Reverse Unknowns

## 運転診断結果の共有範囲と第三者提供の可否

**description**: score/score_history/capability_score は端末ローカルの SQLite にのみ格納され、サーバ送信のコードは存在しない。しかしパッケージ名 jp.co.nissan.drivingscore と社内配布バッチの存在から実証実験や研究用に走行データを回収する運用が想定される。誰がどこまで走行データを閲覧できるか(本人のみ/家族/自動車メーカ/研究機関)というポリシーはコードから判断できない。

**evidence**: src/data/src/app/services/score-db.service.ts, src/data/android/app/src/main/AndroidManifest.xml, src/install-windows.bat

**impact**: high

**suggested_question**: 本アプリで得られた運転診断結果・録画・センサーログは、本人以外にどの範囲まで共有・分析される想定ですか？(社内評価のみ/研究用データセット化/家族への通知など)


## 録画動画・センサーログの保持期間と削除ポリシー

**description**: MediaRecorder は /sdcard/Movies/driving-score(実装は Documents 配下)に日時付ファイル名で追記書き出し、センサーログも Documents/driving-score/ 配下に永続化される。削除・世代管理・上限容量に関するコードは無い。プライバシー観点でどの時点で削除すべきかはビジネス判断が必要。

**evidence**: src/data/src/app/driving/driving.page.ts, src/data/src/app/services/log.service.ts

**impact**: high

**suggested_question**: 録画映像とセンサーログの保持期間・自動削除条件・ユーザーが手動削除するUIの必要性はどう定義されていますか？


## 自動ログイン有効期間の根拠 (72時間 vs 3日)

**description**: 設計書には『前回ログイン時から72時間経過していなければ自動でログイン済み』と記載される一方、LoginService.autoLogin() の実装は 3 日(=72時間)相当だが定数化されていない。将来変更した場合の業務影響やセキュリティ要件(共用端末での他者ログイン残留)はコードから判断できない。

**evidence**: docs/運転診断アプリ_詳細設計書_20250228.xlsx.txt, src/data/src/app/services/login.service.ts

**impact**: medium

**suggested_question**: 自動ログイン期限(72時間)の根拠と、共用端末や貸出車両で使う場合の運用ルールを教えてください。


## スコアロジックの動的差し替えのガバナンス

**description**: scoreLogic 本体(JS)は Storage 経由で new Function により実行時評価される。設定画面から端末外部のファイルを選択して読み込めるため、悪意ある差し替えや誤配布時に任意コードがアプリコンテキストで動作しうる。誰がロジックを配布し、どのような検証・署名を経るのかというガバナンスはコードから決定できない。

**evidence**: src/data/src/app/data/score-logic.ts, src/data/src/app/settings/settings.page.ts

**impact**: high

**suggested_question**: 運転診断ロジック(scoreLogic.txt/scoreLogic.json)の配布ワークフローと承認プロセスはどのようになっていますか？署名検証や配布経路の制限は必要ですか？


## 運転診断のスコア表示形式(星/順位)を切替える意図

**description**: settings.scoreShowStar.area1/2/3 で個別スコア/総合/能力指標の表示形式を独立にオン/オフでき、オフ時は『101-score』を順位として表示する。星と順位を切り替える理由(ユーザ属性別/検証用/AB テスト)がコードからは分からない。

**evidence**: src/data/src/assets/data/scoreLogic.json, src/data/src/app/history/history.page.ts, src/data/src/app/comment/comment.page.ts

**impact**: medium

**suggested_question**: スコアの星表示と順位表示は誰向けに使い分ける前提ですか？ユーザー属性やモード切替のトリガ条件はありますか？


## センサーモード(smartphoneOnly/canDataOnly/combination)の使い分け方針

**description**: 設定でセンサーモードを切替可能で、simple/CAN対応の 2 種のスコアロジックが同居する。しかしユーザが自ら選ぶのか、車両検知や車種で自動判定するのか、あるいは営業/研究フェーズで固定するのかは分からない。

**evidence**: src/data/src/app/settings/settings.page.ts, src/data/src/assets/data/scoreLogicFunction_simple.txt, src/scoreLogicFunction.js

**impact**: medium

**suggested_question**: スマホのみ/CANのみ/併用モードは、どのような場面で使い分けを想定していますか？エンドユーザーが選ぶのか、車両で自動判定するのか？


## 能力指標(scoreA=歩行, scoreB=注意, scoreC=視野)の医療的解釈

**description**: 駐車行動の減速度/速度/加速度を正規分布でスコア化し『歩行機能・認知/注意機能』に対応付けているが、この対応関係の医学的根拠、対象ユーザ層(高齢者ドライバなど)、活用先(家族通知/免許返納提案/医療連携)はコードのみからは判断できない。

**evidence**: src/scoreLogicFunction.js, src/data/src/assets/data/scoreLogic.json, src/data/src/app/history/history.page.ts

**impact**: high

**suggested_question**: 能力指標(scoreA/B/C)は誰にどんな意思決定に使ってもらう指標ですか？医学的レビューは受けていますか？


## 対象交差点マスタが横浜みなとみらい周辺のみである理由

**description**: scoreLogic.json の intersection マスタが 5 交差点のみで構成されている。実証実験の範囲固定なのか、将来的に全国展開して差し替える運用なのか、地図データベースと連携する予定なのかがコードからは決定できない。

**evidence**: src/data/src/assets/data/scoreLogic.json

**impact**: medium

**suggested_question**: 現状の交差点マスタが横浜みなとみらい周辺のみである理由と、今後の対象エリア拡張方針は決まっていますか？


## ヒヤリ判定閾値(縦横加速度 Jerk > 0.4G/s、gamma>=35°等)の根拠

**description**: CAN対応ロジックのヒヤリ発火閾値や、simple 版の accel z<=-1.8, gamma>=35 などのしきい値はハードコードされているが、これが安全工学的なガイドライン準拠なのか経験値なのか、また車種による調整余地はコードから分からない。

**evidence**: src/scoreLogicFunction.js, src/data/src/assets/data/scoreLogicFunction_simple.txt

**impact**: medium

**suggested_question**: ヒヤリ/減点判定のしきい値はどのような根拠(実験/公的ガイドライン/経験値)で決めていますか？車種や運転者ごとに変える運用はありますか？


## Google Maps API キーの管理方針

**description**: environment.ts と AndroidManifest に Google Maps API キーが平文で埋め込まれている。テスト用/本番用の切替や、露出しても構わない制限付きキーなのかどうかはビジネス判断であり、コードだけでは判断できない。

**evidence**: src/data/src/environments/environment.ts, src/data/android/app/src/main/AndroidManifest.xml

**impact**: medium

**suggested_question**: アプリに埋め込まれている Google Maps API キーは公開しても問題ないよう API 制限を掛けていますか?本番/検証で分ける必要はありますか?

