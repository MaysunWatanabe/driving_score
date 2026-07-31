# Reverse Unknowns

## スコアの共有範囲は個人内のみか運転者間で比較・共有されるか

**description**: 全DBがローカルSQLiteに閉じ、サーバ通信が存在しないため個人利用に見えるが、user_idでのマルチアカウント/BLE車載機共有が想定されているかは業務要件次第で判断できない。

**evidence**: data/src/app/services/score-db.service.ts, data/src/app/services/user-db.service.ts

**impact**: high

**suggested_question**: 運転診断データは端末所有者本人にのみ閉じたものか、それとも家族・法人フリート等で複数ドライバー間の閲覧/共有を想定していますか？


## 運転診断ログ/動画の保持ポリシー

**description**: movie.webm/log.*.gz/sensor-log.*.gzは診断ごとにDocuments配下へ延々と追加されるが、自動削除や上限、共有・提出の想定は実装から読み取れない。

**evidence**: data/src/app/services/log.service.ts, data/src/app/driving/driving.page.ts

**impact**: medium

**suggested_question**: 保存された動画・センサーログは何日/何件で自動削除しますか？また外部へ提出する用途はありますか？


## MD5パスワードハッシュを継続利用する意図

**description**: パスワードはts-md5でMD5化のみ(saltなし、bcrypt/argon2未使用)。技術的負債の可能性もあるが業務要件で許容されているかは判断できない。

**evidence**: data/src/app/services/login.service.ts, data/src/app/account/account.page.ts

**impact**: high

**suggested_question**: 端末内ローカル認証のみを前提としMD5で十分と判断していますか?将来サーバ連携する予定はありますか?


## 対象BLE車載機の入手性と正式仕様

**description**: BLE名'DrivingCanData'、UUID 0x2310/0x2311、11バイト固定のCANデータフォーマットが前提。市販製品か、Nissan社内試作機か判断できない。

**evidence**: data/src/app/data/ble.ts, data/src/app/services/sensor.service.ts

**impact**: high

**suggested_question**: BLEで接続する車載機は市販品ですか、それとも社内試作機ですか?配布/量産計画とセキュアな認証は必要ですか?


## 運転診断JSロジックの動的書換の承認プロセス

**description**: 設定ページからアップロードされたスコアロジック(任意のJS文字列)を`new Function`で即実行する。誰がロジック更新を承認し、誰が配布するのかは業務判断。

**evidence**: data/src/app/settings/settings.page.ts, data/src/app/data/score-logic.ts

**impact**: high

**suggested_question**: スコアロジックの差し替えは誰(開発者/研究者/エンドユーザー)が行えることを想定していますか?配布パスと承認フローはどうしますか?


## 能力指標scoreA/B/Cの業務定義

**description**: scoreLogic.jsonでラベルは'歩行機能'/'注意機能'等が例示されているが、A=歩行、B=注意、C=空欄と、UIも動的ラベルに追従する。指標の意味付けはロジック側に閉じている。

**evidence**: data/src/assets/data/scoreLogic.json, data/src/app/data/score.ts

**impact**: medium

**suggested_question**: 能力指標scoreA/B/Cはどの身体/認知機能を測るものと定義していますか?表示ラベルは固定ですか、契約先ごとに可変ですか?


## スコアの'★表示'と'順位表示'切替の意図

**description**: score_show_star.area1〜3で得点表示(0-100)と順位表示(rank=101-score)を切り替える。UX上の使い分けはコードから判断できない。

**evidence**: data/src/app/history/history.page.ts, data/src/app/comment/comment.page.ts, data/src/assets/data/scoreLogic.json

**impact**: low

**suggested_question**: ★(スコア)表示と順位表示は誰がいつ切り替える想定ですか?店舗/研究用途で使い分けますか?


## 対象交差点(横浜みなとみらい5交差点)の位置付け

**description**: scoreLogic.jsonにけいゆう病院前など5交差点が固定登録されている。汎用アプリなのか特定エリアの実証用か判定できない。

**evidence**: data/src/assets/data/scoreLogic.json

**impact**: medium

**suggested_question**: 対象交差点はデモ/実証用に限定した固定リストですか?本番では動的に取得しますか?


## orderOfMessageの切替UI

**description**: positive/negativeの表示順序を切り替える設定だが、変更手段はscoreLogic.jsonのorder_of_messageのみで、アプリのSettings UIには露出していないように見える。

**evidence**: data/src/app/services/login.service.ts, data/src/app/comment/comment.page.ts

**impact**: low

**suggested_question**: orderOfMessage(1/0)はJSON編集専用の想定ですか?エンドユーザー向けに切替UIを提供する予定はありますか?


## GPSデモモードとセンサーモード(smartphoneOnly/canDataOnly/combination)の運用

**description**: 設定に3種のセンサーモードとGPSデモフラグが存在するが、canDataOnly/combinationで実運用する対象ユーザ/シチュエーションが不明。

**evidence**: data/src/app/settings/settings.page.ts, data/src/app/services/login.service.ts, data/src/app/services/sensor.service.ts

**impact**: medium

**suggested_question**: canDataOnly/combinationモードは開発者向けの検証機能ですか、エンドユーザーも選択できますか?

