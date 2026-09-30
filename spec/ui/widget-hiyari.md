<!-- 作成: 2026-09-30 18:00:09 JST -->

# ホーム画面ウィジェット 2-1a『本日のヒヤリ件数』仕様（ui.widget.hiyari）

## 1. 概要

| 項目 | 内容 |
|---|---|
| ノード ID | `ui.widget.hiyari` |
| 画面番号 | 2-1a（ホーム画面ウィジェット） |
| 種別 | Android ホーム画面ウィジェット（アプリ外 UI） |
| 目的 | 本日のヒヤリ件数をホーム画面に表示する |
| 位置づけ | 提案デザインのプロトタイプ。**debug ビルド限定**で実装する |
| 仕様書 | `spec/ui/widget-hiyari.md` |

本ノードは、ホーム画面ウィジェット 2-1a に関する仕様の**唯一の集約先**です（§6 参照）。

> **注記**: 本ウィジェットは 2026 年度改修要求 5 本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE 安定化 ⑤録画データサイズ改善）には含まれていません。改修要求とは別枠のプロトタイプとして扱います。

---

## 2. 提供範囲

- debug ビルドでのみ提供します。
- release ビルドで提供するかどうか、提供する場合の条件は未確定です（§8 OQ-1）。
- プロトタイプの目的は、提案デザイン（アイコンと件数の横並び）の見え方を確認することです。

---

## 3. 表示仕様

### 3.1 表示要素

| 要素 | 内容 | 編集 |
|---|---|---|
| アイコン | ヒヤリを表すアイコン | 不可 |
| 件数 | 本日のヒヤリ件数（`count`） | 不可（読み取り専用） |

### 3.2 レイアウト

- アイコンと件数を**横並び**で配置します（提案デザイン）。
- 次の項目は未確定です。
  - ウィジェットのサイズ（セル数）
  - 件数の書式（単位表記の有無など）
  - 桁あふれ時の扱い
- 上記の未確定事項は §8 OQ-5 で扱います。

### 3.3 表示状態

| 状態 | 表示 |
|---|---|
| `count` が保存済み | 保存されている件数を表示する |
| `count` が未保存（アプリで一度も更新されていない など） | **未確定**（§8 OQ-3） |
| 日付が変わった後で、まだ更新されていない | **未確定**（§8 OQ-2） |

---

## 4. データの受け渡し

### 4.1 保存先（ウィジェットが読み取る値）

保存先は SharedPreferences です。

| 項目 | 値 |
|---|---|
| ファイル名 | `hiyari_widget` |
| キー `count` | 本日のヒヤリ件数 |
| キー `updatedAt` | 最終更新日時 |

- ウィジェットは `count` を表示に使用します。
- `updatedAt` を表示や日付判定に使うかどうかは未確定です（§8 OQ-2）。

### 4.2 更新インターフェース（アプリ → ウィジェット）

アプリ（Web 層）は、Capacitor プラグイン `HiyariWidget` を次のように呼び出して件数を渡します。

```ts
HiyariWidget.update({ count })
```

- ウィジェットには、この呼び出しで渡された `count` が表示されます。
- 次の項目は UI の責務外であり、未確定です（§8 OQ-4）。
  - 誰が `update` を呼び出すか
  - いつ呼び出すか（ヒヤリ発生時／アプリ起動時／診断終了時 など）
  - 件数をどう集計するか

---

## 5. 操作

| 操作 | 結果 |
|---|---|
| ウィジェット上で件数を編集 | 不可。ウィジェットに入力要素はない |
| ウィジェットをタップ | **未確定**（アプリの起動や特定画面への遷移を行うか。§8 OQ-6） |

---

## 6. 仕様の集約について（設計上の注記）

- ホーム画面ウィジェット 2-1a に関する fact は、本ノード `ui.widget.hiyari` に集約済みです。
  - 集約対象: #4760 / #4766 / #4768 / #4769 / #4770
  - #4767 は superseded です（後継は #4768）。
- 旧別名ノード `ui.widget.home` / `ui.todayHiyari.widget` / `ui.widget.dailyCount` / `ui.home.widget` は廃止しました。
  - 今後はこれらのノード名で仕様を追加しないでください。
- `ui.history.page` には、ウィジェット関連の fact は残っていません。
  - 同ノードに残る fact は #4482 / #4483 のみです。
- Capacitor 設定側の fact #4761 は、`env.config.capacitor` に帰属させたままです。
  - 本ノードと `env.config.capacitor` を参照 edge で結ぶ場合は、別 proposal で扱います。
- 実装・証跡の紐づけは次のとおりで、集約後も変更していません。

| 種別 | 内容 |
|---|---|
| コード | PR #20 / commit `8ddf639` |
| spec_code_mapping | mapping_id=1 |
| スクリーンショット | kind=actual、6 枚 |

---

## 7. 責務分担

| 責務 | 担当 |
|---|---|
| 件数の表示、アイコンとの横並びレイアウト | UI（本ノード） |
| 本日のヒヤリ件数の集計、`update` の呼び出し契機 | Middleware（要確認） |
| Capacitor プラグインの登録、debug 限定のビルド構成 | env.config.capacitor |

---

## 8. 未確定事項

| ID | 内容 | 判断が必要なドメイン | 決まらないと影響するもの |
|---|---|---|---|
| OQ-1 | release ビルドでの提供可否 | PM / env | 提供範囲、QA の対象ビルド |
| OQ-2 | 「本日」の境界（日付の切り替わり、タイムゾーン）。日付をまたいで未更新の場合、前日の件数を表示するか 0 に戻すか。`updatedAt` をこの判定に使うか | Middleware / UI | 表示の正確さ |
| OQ-3 | `count` が未保存のときの表示（0／ハイフン／非表示 など） | UI / PM | 初回表示 |
| OQ-4 | `HiyariWidget.update` を呼び出す契機と、件数の集計元 | Middleware | 件数の鮮度と正しさ |
| OQ-5 | ウィジェットのサイズ、件数の書式、桁あふれ時の扱い | UI / 先方 | デザインの確定 |
| OQ-6 | タップ時の動作（アプリ起動や遷移先の有無） | UI / PM | 導線 |
| OQ-7 | 集約済み fact（#4760 / #4766 / #4768 / #4769 / #4770）の本文が本ノードに提示されていない。§3〜§5 の未確定事項と重なる内容の有無を照合する必要がある | Orchestrator | 本仕様の網羅性 |
| OQ-8 | iOS 対応の有無 | PM / env | 対象プラットフォーム |

```json
{
  "required_changes": [
    {"node": "ui.widget.hiyari", "entrypoint": "spec/ui/widget-hiyari.md", "description": "ホーム画面ウィジェット2-1aの仕様を本ノードに集約し、SharedPreferences(hiyari_widget/count/updatedAt)とHiyariWidget.update({count})による本日のヒヤリ件数表示、アイコン横並びの提案デザイン、debug限定プロトタイプであることを記載する"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware", "severity": "should", "reason": "本日のヒヤリ件数の集計方法とHiyariWidget.update({count})を呼び出す契機、日付切り替わり時の扱いが未定義でありウィジェット表示の正しさに直結する"},
    {"domain": "env.config.capacitor", "severity": "should", "reason": "HiyariWidgetプラグインの登録とdebugビルド限定の構成は#4761側で管理されており、ui.widget.hiyariとの参照edgeは別proposalで扱う必要がある"},
    {"domain": "QA", "severity": "could", "reason": "debug限定提供であること、count未保存時・日付跨ぎ時の表示を検証観点に含める必要がある（既存screenshot kind=actual 6枚との対応も確認）"}
  ],
  "requirements_context": "ui.widget.hiyariはホーム画面ウィジェット2-1a『本日のヒヤリ件数』の唯一の集約ノードである。本日のヒヤリ件数を、アイコンと件数を横並びにした提案デザインで表示するプロトタイプであり、debugビルド限定で実装する。データはSharedPreferencesのファイルhiyari_widgetに、キーcount(本日のヒヤリ件数)とupdatedAt(最終更新日時)として保存される。アプリはCapacitorプラグインHiyariWidget.update({count})で件数を渡す。ウィジェットは読み取り専用で入力要素を持たない。2-1a関連のfact #4760/#4766/#4768/#4769/#4770は本ノードに集約済みで、#4767はsuperseded(後継#4768)である。旧ノードui.widget.home/ui.todayHiyari.widget/ui.widget.dailyCount/ui.home.widgetは廃止済みで、ui.history.pageには#4482/#4483のみが残る。#4761はenv.config.capacitorに帰属したままであり、参照edgeは別proposalで扱う。コードPR #20/commit 8ddf639、spec_code_mapping mapping_id=1、screenshot kind=actual 6枚の紐づけは変更しない。本ウィジェットは2026年度改修要求5本には含まれない。未確定事項は、release提供可否、本日の境界と日付跨ぎ時の表示、count未保存時の表示、update呼び出し契機と集計元、サイズ・書式・桁あふれ、タップ動作、集約fact本文との照合、iOS対応である。",
  "fact_candidates": [
    {"type": "display_rule", "title": "ウィジェット2-1aは本日のヒヤリ件数を表示する", "statement": "scope=ui.widget.hiyari: ホーム画面ウィジェット2-1aは本日のヒヤリ件数(count)を表示する", "status": "candidate"},
    {"type": "display_rule", "title": "アイコンと件数を横並びで表示する", "statement": "scope=ui.widget.hiyari: ウィジェットはアイコンと件数を横並びに配置した提案デザインで表示する", "status": "candidate"},
    {"type": "constraint", "title": "ウィジェットはdebugビルド限定のプロトタイプ", "statement": "scope=ui.widget.hiyari: 本ウィジェットはdebugビルド限定で実装されるプロトタイプである", "status": "candidate"},
    {"type": "data_semantics", "title": "ウィジェットの表示値はSharedPreferences hiyari_widgetのcountから読む", "statement": "scope=ui.widget.hiyari: ウィジェットが表示する件数はSharedPreferencesのファイルhiyari_widget、キーcountに保存された値である(同ファイルにupdatedAtも保存される)", "status": "candidate"},
    {"type": "api_contract", "title": "HiyariWidget.update({count})で件数を渡す", "statement": "scope=ui.widget.hiyari: アプリはCapacitorプラグインHiyariWidget.update({count})でウィジェットに本日のヒヤリ件数を渡す", "status": "candidate"},
    {"type": "input_rule", "title": "ウィジェット上の件数は編集できない", "statement": "scope=ui.widget.hiyari: ウィジェットは入力要素を持たず、件数は読み取り専用である", "status": "candidate"},
    {"type": "constraint", "title": "2-1aの仕様はui.widget.hiyariに集約する", "statement": "scope=ui.widget.hiyari: ホーム画面ウィジェット2-1aに関する仕様はui.widget.hiyariに集約し、廃止済み別名ノードには追加しない", "status": "candidate"}
  ],
  "open_questions": [
    "release提供可否: 本ウィジェットをreleaseビルドで提供するかが未確定(debug限定プロトタイプとしか決まっていないため)。PM/envの判断が必要で、提供範囲とQA対象ビルドに影響する",
    "本日の境界: 日付切り替わりの基準とタイムゾーン、日付を跨いで未更新の場合に前日件数を表示するか0に戻すか、updatedAtをその判定に使うかが未確定(データ項目はあるが用途が未定義のため)。Middleware/UIの判断が必要で、表示の正確さに影響する",
    "未保存時表示: countが未保存(初回など)のときの表示が未確定。UI/PMの判断が必要で、初回表示に影響する",
    "更新契機: HiyariWidget.updateを誰がいつ呼ぶか、件数の集計元が未確定(UIの責務外で資料にないため)。Middlewareの判断が必要で、件数の鮮度と正しさに影響する",
    "デザイン詳細: ウィジェットのサイズ、件数の書式、桁あふれ時の扱いが未確定(提案デザイン段階のため)。UI/先方の判断が必要で、デザイン確定に影響する",
    "タップ動作: ウィジェットのタップでアプリ起動や画面遷移を行うかが未確定。UI/PMの判断が必要で、導線に影響する",
    "集約fact照合: #4760/#4766/#4768/#4769/#4770の本文が本composeに提示されておらず、本仕様の未確定事項と重なる内容がないか照合が必要。Orchestratorの確認が必要で、仕様の網羅性に影響する",
    "iOS対応: SharedPreferences前提の記述のみでiOS対応の有無が未確定。PM/envの判断が必要で、対象プラットフォームに影響する"
  ],
  "rationale_notes": [
    "ウィジェットは表示責務のみを持ち、件数の集計とupdate呼び出しはアプリ側(Middleware)の責務として分離した",
    "集約済みfactの本文が提示されていないため、その内容を推測で本文化せず、集約の事実とノード廃止の経緯のみを設計注記として残した",
    "本ウィジェットは2026年度改修要求5本に含まれないため、改修スケジュール(11月末完了)の対象範囲とは区別して扱う前提で記載した"
  ]
}
```