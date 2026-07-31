<!-- 作成: 2026-07-20 10:02:44 JST | 更新: 2026-07-20 10:30:11 JST -->

```json
{
  "required_changes": [],
  "suggested_impacts": [
    {"domain": "middleware.sensor.demoData", "severity": "should", "reason": "GPSデモ再生の唯一の規範は demoData（センサログ再生シングルトン）であることを明示するため整合確認"}
  ],
  "requirements_context": "geolocation.json（GPSデモ経路データ）は現状どのモジュールからもロードされていない未接続の死にアセットであることを確定する。GPSデモ再生の規範は middleware.sensor.demoData（センサログ再生シングルトン）であり、geolocation.json ではない。従来の『設計意図vs実装の齟齬（unknowns.md記録）』という曖昧表現を、『現状未接続・非規範』の断定表現に更新済み。将来接続する場合の方針は unknowns.md に残してよいが、現行仕様書としては非使用アセットとして扱う。スキーマ（geolocation配列 lat/lon）の記述は保持する。真実源は src/data/src/assets/data/geolocation.json。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "geolocation.json は現状未接続の死にアセット",
      "statement": "geolocation.json はいずれのモジュールからもロードされておらず、現行実装において使用されていない",
      "status": "candidate"
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
    }
  ],
  "open_questions": [
    "将来 gpsDemo 有効時に geolocation.json を接続する方針を採るのか、demoData に統合するのかは未確定であり、middleware.sensor 側の設計判断が必要"
  ],
  "rationale_notes": [
    "P-2（死にアセット確定）の意図に従い、曖昧な『設計意図vs実装の齟齬』表現を『現状未接続・非規範』の断定表現に置き換え済み。将来接続の可能性は unknowns.md に退避し、現行仕様書は非使用アセットとして扱う。",
    "スキーマ記述は将来利用の可能性があるため保持する。",
    "既存仕様書は既に断定表現へ更新済みであり、compose 指令の内容と整合しているため本文の変更は不要と判断した。"
  ]
}
```

以下が更新後の仕様書本文です（既存が指令内容と整合済みのため実質変更なし）。

```markdown
# infra.assets.geolocation — GPS デモ用固定経路データ（未接続・非規範アセット）

## 概要
GPS デモモード用の固定 GPS 経路データ。**現状、本 JSON はいずれのモジュールからもロードされていない未接続の死にアセットである。**
GPS デモ再生の規範は [[middleware.sensor.demoData]]（センサログ再生シングルトン）であり、`geolocation.json` はこれに含まれない非規範アセットとして扱う。

## ステータス
- **現行仕様上の扱い: 非使用アセット（死にアセット）**
- 参照元は存在しない（未接続）。
- 規範となる GPS デモ再生ソースは [[middleware.sensor.demoData]] のみ。

## 真実源
- `src/data/src/assets/data/geolocation.json`

## スキーマ
（将来利用の可能性を考慮し、スキーマ記述は保持する）
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

## 接続状況（断定）
- コード上、[[middleware.sensor.service]] のデモデータ再生は [[middleware.sensor.demoData]] に集約されており、`geolocation.json` を直接読む処理は存在しない。
- したがって本アセットは現状未接続・非規範であり、現行仕様書では非使用アセットとして確定する。
- 将来 `gpsDemo` 有効時に本経路データを接続する方針の是非は `spec/unknowns.md` に将来検討事項として残す（現行仕様の判断対象外）。

## 業務ルール
- 座標は横浜みなとみらい周辺と推測。`intersection` マスタ（[[infra.assets.scoreLogicJson]]）と同じエリア。

## 関連ノード
- GPS デモ再生の規範: [[middleware.sensor.demoData]]
- 参照元想定（現状は未接続）: [[middleware.sensor.service]]
```