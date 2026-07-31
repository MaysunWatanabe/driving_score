---
description: BUILD モードに切替。確定 fact / proposal に基づいてコードを実装するフェーズ
---

[BUILD モード起動]

`.claude/state/current_mode` を `BUILD` に更新します。Bash で以下を実行:

```bash
echo BUILD > .claude/state/current_mode && date -Iseconds > .claude/state/mode_changed_at
```

## BUILD モードの責務

確定した fact / proposal に基づいてコードを修正し、テストを通し、commit する。**仕様判断はこのモードで一切行わない**。

### 実装前 spec 確認ブロック（最初に必ず出力）

最初の Edit / Write / Bash (コード変更を伴うもの) の前に、必ず以下のブロックを出力すること。
**このブロック無しでの Edit/Write は PreToolUse hook で block されます**。

```
## 実装前 spec 確認

| 判断項目 | ソース種別 | ID | 値 |
|---|---|---|---|
| <ノードパス.属性> | fact / proposal | <fact_id / proposal_id> | <確定値> |
| ... | ... | ... | ... |

未確定項目: なし | あり (→ /propose-mode に戻る)
```

#### ブロックの要件

- 表内の **全ての判断項目** にソース種別と ID を記入
- ソース `fact` は status=approved のもののみ採用可
- ソース `proposal` は status=synced/decided かつ ready_to_implement=true のもののみ採用可
- 未確定項目が 1 つでもあれば実装中止 → `/propose-mode` に戻る

### 必ずやること

1. **最新 fact / proposal を再取得** — BUILD 開始時点で `ask_repository` を再度叩く（前回 ASK から時間が経っていれば必須）
2. **drift branch を作成 / チェックアウト** — `drift-YYYYMMDD-<slug>` 形式
3. **コードのみを編集** — `app/` `src/` 配下を Edit / Write
4. **テスト実行** — unit + E2E（CLAUDE.md §9〜§14 のルールに従う）
5. **commit message に proposal/fact ID を含める** — commit-msg hook で必須化されている
6. **record_implementation を呼ぶ** — `record_implementation(proposal_id, changed_files, test_results)`
7. **push_spec_code_mapping を呼ぶ** — node ↔ ファイルパスをマップ

### 絶対にやらないこと

- ❌ **`spec/*.md` の編集 / 新規作成** — recast の責務、BUILD では一切触らない
- ❌ **`canonical_spec.json` の編集** — 同上
- ❌ **`spec/SPEC_INDEX.md` の編集** — 同上
- ❌ 確定していない数値・分岐を「とりあえず」実装する（必ず PROPOSE に戻る）
- ❌ commit message に proposal/fact ID を書かずに commit する
- ❌ main ブランチへ直接 commit
- ❌ 確認ブロックなしで Edit/Write を呼ぶ

### branch 命名規則

```
drift-YYYYMMDD-<slug>
```

- `<slug>` は会話の主題から導出（ハイフン区切り、小文字、英数）
- 例: `drift-20260508-wheel-picker-scale-3step`

### commit message テンプレート

```
<type>(<scope>): <一行サマリ> (proposal #<id> / fact #<id>)

<本文: 何を変えたか、根拠 proposal/fact の要点>

Refs: proposal #<id>, fact #<id>
```

例:
```
feat(ui): wheel_picker を 3 段階階段スケールに変更 (proposal #97)

- WheelPickerItem: scale を {center:1.5, mid:1.1, edge:0.7} に
- alpha も連動: {1.0, 0.85, 0.5}
- proposal #97 (synced, decision_type=auto_b) に厳密従

Refs: proposal #97, fact #2257
```

### 実装完了後の必須アクション

```
1. record_implementation(proposal_id=N, changed_files=[...], test_results={unit:..., e2e:...})
2. push_spec_code_mapping(mappings=[{node_id:..., file_path:..., line_range:...}])
3. (UI を変更した場合) 各 UI 画面を撮影し upload_screenshot(kind="actual") で還流
   - repository_id / session_id / generation は .smith から渡す（詳細は CLAUDE.md §14-3）
4. git push origin <drift-branch>
5. ユーザに PR 作成可否を確認
```

> UI 実装の **前** にも `get_ui_screenshots(node_id, kind="design")` で設計モックを取得し、あれば合わせて実装すること（CLAUDE.md §14-2）。

### 次に進む条件

- 実装完了 + テスト全パス + push 完了 → ユーザに完了報告、PR 作成判断を仰ぐ
- 実装中に新たな判断点が発生 → 即座に `/ask-mode` に戻る
- テストが落ちた → `/ask-mode` に戻り原因が仕様起因か実装起因か判定
