<!-- 作成: 2026-08-24 14:14:06 JST -->

```json
{
  "required_changes": [
    {"node": "env.repo.gitignore", "entrypoint": "spec/env/repo-gitignore.md", "description": "approved 1-A に合わせ、.smith / .claude/state / bak パターンの gitignore、git rm --cached、bind、package-lock.json 復元を仕様本文へ反映する"}
  ],
  "suggested_impacts": [
    {"domain": "env.build.installer", "severity": "must", "reason": "各自の projectsmith bind --repo-id <id> 手順を README または installer 仕様に明記する必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "CI/クローン後に .smith がリポジトリに含まれない前提になるため、ビルド・検証ジョブがローカル状態に依存していないか確認が必要"}
  ],
  "requirements_context": "# リポジトリ .gitignore 方針\n\n## 目的\n開発者ローカルのツール状態と復元一時ファイルを版管理対象から除外する。クローン後は各自が ProjectSmith を bind してローカル環境を再構成する。現状実装の追認ではなく、approved design_decision（方針 1-A）をこのノードの正とする。\n\n## 必須の ignore / 追跡除外\n\n### ProjectSmith ローカル状態（.smith）\n- `.gitignore` に `.smith` を追加しなければならない。\n- 既に Git 追跡されている場合は `git rm --cached .smith` でインデックスから外さなければならない（作業ツリー上のディレクトリ自体は残してよい）。\n- `.smith` は開発者ローカル専用であり、リポジトリで共有してはならない。\n- クローンまたは追跡除外後、各開発者は `projectsmith bind --repo-id <id>` を実行してローカルの `.smith` を再構成しなければならない。\n- bind 手順は README または env.build.installer 仕様に明記しなければならない。\n\n### Claude ローカル状態\n- `.gitignore` に `.claude/state/` を追加しなければならない。\n- `.claude/state/` は開発者ローカル専用であり、リポジトリで共有してはならない。\n\n### 復元前バックアップ\n- 復元前に作成された `.bak` ファイル 6 件はリポジトリから削除しなければならない。\n- `.gitignore` に `*.bak.[0-9]*-[0-9]*` を追加しなければならない。\n\n## 追跡を維持する対象\n- `package-lock.json` は `.gitignore` 対象にしてはならない。\n- `package-lock.json` を誤って削除または改変した場合は `git checkout` でリポジトリ上の版に戻さなければならない。\n\n## 運用上の前提\n- リポジトリの正本に ProjectSmith のローカル bind 状態を含めない。\n- 新規クローン後にスコア計算・センサー・BLE 等のアプリ実行前提を満たすことと、`.smith` 再 bind は別手順である。\n- 本ノードは実行ランタイムや環境変数の値自体は定めない。対象は版管理から除外するパスと、除外後の再構成手順の置き場所である。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": ".smith を gitignore する",
      "statement": ".gitignore に .smith を追加しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": ".smith をインデックスから外す",
      "statement": "既に追跡されている .smith は git rm --cached .smith でインデックスから外さなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "各自が projectsmith bind する",
      "statement": "各開発者は projectsmith bind --repo-id <id> を実行してローカルの .smith を再構成しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": ".claude/state/ を gitignore する",
      "statement": ".gitignore に .claude/state/ を追加しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "復元前 .bak 6 ファイルを削除する",
      "statement": "復元前に作成された .bak ファイル 6 件はリポジトリから削除しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "番号付き bak パターンを gitignore する",
      "statement": ".gitignore に *.bak.[0-9]*-[0-9]* を追加しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "package-lock.json は checkout で戻す",
      "statement": "package-lock.json は ignore せず、誤削除・改変時は git checkout でリポジトリ上の版に戻さなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "bind 手順をドキュメントに明記する",
      "statement": "projectsmith bind 手順は README または env.build.installer に明記しなければならない",
      "status": "approved"
    }
  ],
  "open_questions": [
    "projectsmith bind の <id> 具体値が未記載である。リポジトリ識別子が環境ドキュメントに無いため未確定。env.build.installer または README 担当の判断が必要。決まらないとクローン後に bind できず .smith を再構成できない。",
    "bind 手順の記載先が README か env.build.installer か未選択である。fact が「または」のため単一の正本が無い。Env / インストーラ仕様の判断が必要。決まらないと手順が分散し、gitignore 後のセットアップ欠落が起きる。",
    "削除対象の復元前 .bak 6 ファイルのパス一覧が未記載である。入力資料にファイル名が無いため特定できない。リポジトリ現状を知る実装/Infra 側の確認が必要。決まらないと削除漏れまたは無関係ファイル削除のリスクがある。"
  ],
  "rationale_notes": [
    "方針 1-A はローカルツール状態を共有せず、クローン後に各自 bind する運用を選んだものである。",
    "package-lock.json を checkout で戻すのは、依存ロックファイルをリポジトリの正本として維持するためである。",
    "本ノードは gitignore とローカル再構成に限定し、10ms 周期・センサーゲート・BLE rate など他ノードの実行仕様は扱わない。"
  ]
}
```