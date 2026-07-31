<!-- 作成: 2026-07-20 10:02:46 JST | 更新: 2026-07-20 10:30:07 JST -->

```json
{
  "required_changes": [
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "infra.assets.geolocation を『参照元想定（未接続）』から『未参照（死にアセット）』へ明確化する"}
  ],
  "suggested_impacts": [
    {"domain": "infra-agent", "severity": "should", "reason": "infra.assets.geolocation(geolocation.json) が現状どのモジュールからもロードされない死にアセットである点を infra 側でも整合させる必要がある"}
  ],
  "requirements_context": "SensorService は全センサー(GPS/加速度/ジャイロ/磁力計/BLE-CAN)を購読し 10ms 周期で集約・キャリブレーション後にコールバックへ渡す。非 Android 時は DemoData.getSensorLogData() を用いてデモ再生する（現行仕様を維持）。今回の P-2 は infra.assets.geolocation(geolocation.json) への参照実態を『参照元想定（未接続）』から『未参照（現状どのモジュールからもロードされない死にアセット）』へ明確化するもの。10ms 周期集約、センサー個別リスナ、キャリブレーション連携、センサーモード分岐(smartphoneOnly/canDataOnly/combination) 等のロジックは一切変更しない。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "geolocation.json はどのモジュールからもロードされない",
      "statement": "infra.assets.geolocation(geolocation.json) は現状どのモジュールからもロードされておらず、死にアセットである",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "非 Android 時のデモ再生は DemoData に集約されている",
      "statement": "SensorService は非 Android 環境で DemoData.getSensorLogData() を用いてセンサーログを再生する",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "SensorService は geolocation.json を直接参照しない",
      "statement": "SensorService はデモ再生において geolocation.json を直接ロードせず、DemoData 経由のデータのみを用いる",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "非 Android 時に geolocation を Ionic Storage へ保存する",
      "statement": "SensorService は非 Android 時に DemoData.getSensorLogData() の geolocation を Ionic Storage の geolocation-last-pos-key に保存する",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "センサーモード分岐は3種類で維持される",
      "statement": "SensorService はセンサーモード smartphoneOnly/canDataOnly/combination の分岐ロジックを本 P-2 で変更しない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "10ms 周期集約は維持される",
      "statement": "SensorService は 10ms 周期でセンサー値を集約しキャリブレーション後にコールバックへ渡すロジックを本 P-2 で変更しない",
      "status": "approved"
    }
  ],
  "open_questions": [
    "geolocation.json を今後利用予定があるのか（削除対象か将来接続予定か）は infra ドメインの判断が必要。放置すると死にアセットの扱いが宙ぶらりんになる"
  ],
  "rationale_notes": [
    "本 P-2 はロジック変更を伴わない仕様記述の明確化のみ。依存グラフ上 infra.assets.geolocation を『依存』として残すと誤って参照実態があるかのように読めるため、未参照アセットとして注記に降格する意図がある",
    "非 Android 時の geolocation は DemoData 経由で取得され Ionic Storage に保存される。これは geolocation.json を直接ロードしないことと矛盾しない（DemoData がソースであり geolocation.json ではない）"
  ]
}
```