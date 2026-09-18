<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:36:17 JST -->

```json
{
  "required_changes": [
    {"node": "infra.assets.geolocation", "entrypoint": "spec/infra/assets-geolocation.md", "description": "将来接続検討の記述を削除し『復活・利用再開は行わない』と明記、未決事項を『削除可否』に差し替え"}
  ],
  "suggested_impacts": [
    {"domain": "middleware.sensor.demoData", "severity": "could", "reason": "GPSデモ再生の規範が demoData 側にあることの整合確認のみ（geolocation.json 側の変更は不要）"}
  ],
  "requirements_context": "geolocation.json（GPSデモ用固定経路データ）は middleware.sensor.service から未参照であり、いずれのモジュールからもロードされていない死にアセットであることを承認済みファクトとして確定する。本アセットの復活・利用再開は行わない（将来 gpsDemo 有効時に接続するという検討方針は取り下げ）。GPSデモ再生の規範実装は middleware.sensor.demoData（センサログ再生シングルトン）であり、geolocation.json は非規範。仕様書は (1) アセットが現存している事実、(2) 非参照である事実、(3) 削除可否が未決である事実のみを記述し、利用再開の設計方針は記載しない。スキーマ（geolocation 配列、各要素 lat/lon）の記述はアセット同定のため保持する。真実源は src/data/src/assets/data/geolocation.json。座標は横浜みなとみらい周辺と推測され、scoreLogic.json の intersection マスタと同エリアであることは推測レベルの注記として保持する。UC06（運転診断の実行）に対して本アセットは寄与しない。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "geolocation.json は middleware.sensor.service から未参照",
      "statement": "geolocation.json は middleware.sensor.service から参照されておらず、いずれのモジュールからもロードされていない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "geolocation.json の復活・利用再開は行わない",
      "statement": "geolocation.json を再接続して利用を再開する対応は行わない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "GPSデモ再生の規範は middleware.sensor.demoData",
      "statement": "GPSデモ再生の規範実装は middleware.sensor.demoData（センサログ再生シングルトン）であり、geolocation.json は非規範である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "geolocation.json のスキーマは lat/lon 配列",
      "statement": "geolocation.json は geolocation 配列を持ち、各要素は lat/lon の座標を保持する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "geolocation.json の真実源パス",
      "statement": "geolocation.json の真実源は src/data/src/assets/data/geolocation.json である",
      "status": "candidate"
    },
    {
      "type": "open_question",
      "title": "geolocation.json の削除可否は未決",
      "statement": "geolocation.json をリポジトリおよびバンドルから削除するか残置するかは未決である",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "geolocation.json を削除するか残置するかが未決。非参照であることは確定しているがアセット削除の影響（ビルド成果物・過去バージョン検証・他資産との関連）の確認が済んでいないため。infra（アセット管理）と middleware.sensor の双方の合意が必要で、決まらないとバンドルサイズ削減および死にアセット棚卸しの完了判定に影響する。"
  ],
  "rationale_notes": [
    "承認済みファクト『復活・利用再開は行わない』により、旧仕様書にあった『将来 gpsDemo 有効時に接続する方針の是非を unknowns.md に残す』という記述は取り下げ、未決事項を『削除可否』のみに絞った。",
    "スキーマと座標エリアの注記はアセット同定・棚卸し時の判断材料として保持する（利用再開を意図するものではない）。",
    "座標が横浜みなとみらい周辺で scoreLogic.json の intersection マスタと同エリアという記述は推測であり、断定しない形で保持する。",
    "UC06（運転診断の実行）の実行経路に本アセットは含まれないため、UC06 仕様上は寄与ゼロの参考情報として位置づける。"
  ]
}
```

以下が更新後の仕様書本文です。

```markdown
# infra.assets.geolocation — GPS デモ用固定経路データ（非参照・死にアセット）

## 概要
GPS デモモード用の固定 GPS 経路データ。**本 JSON は [[middleware.sensor.service]] から参照されておらず、いずれのモジュールからもロードされていない死にアセットである。**
GPS デモ再生の規範は [[middleware.sensor.demoData]]（センサログ再生シングルトン）であり、`geolocation.json` はこれに含まれない非規範アセットである。

## ステータス（確定事項）
- **非参照（死にアセット）**: ロード箇所は存在しない。
- **復活・利用再開は行わない**: 本アセットを再接続して利用を再開する対応は行わない。
- **削除可否は未決**: リポジトリ／バンドルから削除するか残置するかは未決（`spec/unknowns.md` 管理）。
- 規範となる GPS デモ再生ソースは [[middleware.sensor.demoData]] のみ。

本書は「アセットが現存している事実」「非参照である事実」「削除可否が未決である事実」のみを記述する。利用再開に向けた設計方針は記述しない。

## 真実源
- `src/data/src/assets/data/geolocation.json`

## スキーマ
（アセット同定・棚卸し判断のために記述を保持する。利用を意図するものではない）
```
{
  "geolocation": [
    { "lat": 35.46276420185476, "lon": 139.63325783356433 },
    { "lat": 35.46197934870759, "lon": 139.63314967381558 },
    { "lat": 35.46115444377843, "lon": 139.6332873316776  },
    ...
  ]
}
```

## 参照状況（断定）
- [[middleware.sensor.service]] のデモデータ再生は [[middleware.sensor.demoData]] に集約されており、`geolocation.json` を読む処理は存在しない。
- src/data/src 配下・www bundle 上のいずれにも本アセットへのロード経路はない。
- したがって本アセットは非参照・非規範であり、現行仕様では死にアセットとして確定する。

## UC06（運転診断の実行）との関係
- 運転診断の実行経路に本アセットは一切関与しない。GPS デモ再生が行われる場合も経路データ源は [[middleware.sensor.demoData]] である。

## 補足（推測レベル）
- 座標は横浜みなとみらい周辺と推測される。`intersection` マスタ（[[infra.assets.scoreLogicJson]]）と同一エリアと見られるが、両者の関連は未検証。

## 未決事項
- 本アセットを削除するか残置するかは未決（削除影響の確認が未了）。

## 関連ノード
- GPS デモ再生の規範: [[middleware.sensor.demoData]]
- 非参照であることが確定している側: [[middleware.sensor.service]]
- 同エリア座標を持つマスタ（推測）: [[infra.assets.scoreLogicJson]]
```