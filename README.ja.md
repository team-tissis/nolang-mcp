# NoLang for AI agents (Claude Code / Codex plugin · CLI · MCP)
[English](README.md) | 日本語

**[NoLang](https://no-lang.com)** は動画生成 AI のサービスです。作りたい動画を言葉で伝えると、台本・ナレーション・絵・BGM のそろった動画ができます。このプラグインを入れると、Claude Code や Codex に動画を頼んで、見るためのリンクを受け取れます。

1. プラグインを入れて (下の「入れる」のコマンド 1 行)、Claude Code / Codex を起動し直す。
2. 頼む: 「ハンドドリップコーヒーを美味しく淹れるコツを 60 秒で解説する動画を作って」
3. 初回は、ブラウザで NoLang へのログインを求められます。NoLang のアカウントが要ります (その画面で作れます。プランと料金: https://no-lang.com/pricing )。1〜2 分で視聴用のリンクが出て、動画は NoLang のアカウントに残ります。

NoLang を AI エージェントから使うための配布物です (Apache-2.0)。中身は 3 つで、裏は同じ NoLang API・同じアカウントです。

| 物 | 置き場 | 誰向け |
|---|---|---|
| CLI **`@no-lang/cli`** (コマンド名 `nolang`) | `packages/cli/` (起動係だけ — 本体は NoLang の server が配り、起動のたびに揃う) | シェルを持つエージェント (Claude Code・Codex) と人 |
| スキル **`make-video`** | `skills/make-video/` (薄い手順書・文書の写しは持たない) | エージェントが読む段取り |
| プラグイン **`nolang`** | `plugins/nolang/` (build が作る: CLI の起動係 + スキル + Claude Code のリンク通知の hook。MCP の接続は入れない) | Claude Code / Codex に 1 回で入れる |

入口は 2 つで、client ごとに 1 つだけ使います。シェルのある client はプラグイン (CLI)、シェルの無い client は MCP の connector です。

| 入口 | 向いている所 |
|---|---|
| **CLI `nolang`** | シェルを持つエージェント。`nolang make` = 手元の LLM が studio の段取りで台本と画面を書く (質が高い)・`nolang generate` = NoLang の server が書く (速い・手元の LLM は要らない) |
| **MCP** `https://api.no-lang.com/agent/mcp` | シェルの無い client (claude.ai・ChatGPT など) が connector としてつなぐ。既定は model が原稿を書いて `nolang_draft_submit` で渡す (クレジットが安い・検査と直しは server)。急ぎは `nolang_create_video` (依頼文 → server が書く)。状態は `nolang_video_status`・直しは `nolang_edit_video` |

## 入れる (1 回だけ)

前提: **Node.js 20 以上**。`nolang make` には加えて実行エンジン (**Claude Code** か **Codex**・python は要らない・台本は手元の LLM が書くのでその利用量を使う — 下の「前提と制限」)。`nolang generate` は Node だけで動く (server が書く)。MCP は何も入れずに connector をつなぐだけ。

Claude Code (端末で 1 行):

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

Claude Code に頼んでも入ります: 「NoLang のプラグインを入れて。`claude plugin install nolang --marketplace mvrks-inc/nolang-plugin` を実行して」。Claude Code の中なら `/plugin marketplace add mvrks-inc/nolang-plugin` と `/plugin install nolang@nolang` でも入ります。

Codex:

```
codex plugin marketplace add mvrks-inc/nolang-plugin
codex plugin add nolang@nolang
```

入れたら起動し直す (Claude Code は `/reload-plugins` でもよい)。CLI だけ (プラグインなし) を使うための npm パッケージ `@no-lang/cli` も用意しています (`npm install -g @no-lang/cli` か `npx -y @no-lang/cli <command>`)。

### 前提と制限

- **Node.js 20 以上** が要ります。Claude Code 自体には Node.js が入っていないので、別に入れてください ([nodejs.org](https://nodejs.org/))。プラグインの hook も `node` で動きます。
- **入れたら Claude Code を起動し直す (か `/reload-plugins`)。** それまでスキルは読み込まれません。
- **`nolang make` は自分の Claude Code か Codex を使います。** Claude Code は claude.ai の契約でログインしている必要があります。API キーだけ・Bedrock・Vertex の構成では `nolang make` は動きません。その場合は `nolang generate` (server が書く) を使ってください。
- **`nolang make` の費用:** 1 本で、自分の LLM の利用量を API 換算で 約 0.5〜3 ドル使います (mode による。既定の mode で 約 0.5〜1 ドル)。これとは別に、動画の尺に応じて NoLang のクレジットを消費します。
- **未対応:** Windows は未検証です。会社の HTTP proxy には対応していません。
- **手元で起きる事:** `nolang` は起動のたびに `api.no-lang.com` から CLI の本体を取り、署名を確かめてから動かします (詳しくは下の「CLI」)。
- **質問・不具合:** https://github.com/mvrks-inc/nolang-plugin/issues に issue を作ってください (`nolang doctor` の結果か、視聴 URL を添えて)。

## ログインする (1 回だけ)

Claude Code に **「NoLang にログインして」** と頼む (頼まなくても、初めて動画を頼んだ時に聞かれます)。許可の URL が出る (同じ機械ならブラウザも開く) ので、NoLang にログインして「許可」を押し、「許可した」と返す。ログインは 30 日使わなければ切れる。
シェルの無い client (claude.ai など) は、connector に `https://api.no-lang.com/agent/mcp` を足して接続する時にログインする。プラグインは MCP の接続を持たない (同じ client に入口を 2 つ載せない)。

## 頼む

```
ハンドドリップでおいしいコーヒーを淹れるコツを 60 秒で解説する動画を作って
この写真 (~/Desktop/product.png) を背景にして、新商品の紹介動画を縦長で作って
落ち着いた女性の声とピアノの BGM で、在宅勤務のコツを解説する動画を作って
```

- 1〜2 分で視聴 URL が出る。Claude Code では、エージェントの返事より先に `PostToolUse:Bash says:` (か `PostToolUseFailure:Bash says:`) で始まる通知にもリンクが出る。生成中から再生でき、続きは見ている間に伸びる。
- 縦長・長さ・型 (解説 / 数字 / 比較 / 物語 / 映像寄り) は言えばその通りに、言わなければ 16:9 で、長さは内容に合わせて決まる (auto)。動画は頼んだ言葉の言語で作られる (英語で頼めば英語の動画。別の言語にしたい時は「英語で」のように書く)。
- 手元の写真・動画は自分の素材として送られて動画に入る。声・BGM・効果音・書体は説明文から選ばれる (決めたい時は「〇〇な声の候補を探して」)。
- 完成した mp4 が欲しい時は「完成したら mp4 のリンクをちょうだい」。「この動画のここを直して」は元の動画を残したまま直した動画を作る。

### 困った時

| 症状 | どうする |
|---|---|
| ログインの URL を開くのが遅れた | 待ち受けは 15 分。過ぎたらもう一度「NoLang にログインして」 |
| 「claude が無い」と言われる | 入れれば studio の作り方 (質が高い) になる。無いままでも `nolang generate` (server が書く) で作れる |
| つながらない・様子がおかしい | 「nolang doctor を実行して」と頼み、結果を添えて issue を作る (https://github.com/mvrks-inc/nolang-plugin/issues) |
| 生成が `failed` になる・声が出ない | 原稿ではなくサーバー側のことが多い。視聴 URL (video_id) を添えて issue を作る |
| 同時生成の上限 | 同時に生成中にできるのは free / standard で 2 本・premium と法人で 5 本 (本人の数)。前の動画の完成を待つ |

## 更新する

CLI の本体 (studio と文書一式を含む) は接続先の NoLang の server が配り (`GET <api>/agent/client/`)、`nolang` が起動のたびに手元の束 (`~/.config/nolang/client/`) を server と照合して取り直す。server が更新されれば次の `nolang` が新しい本体で動くので、普段は何もしなくてよい。
プラグイン自体 (起動係・スキル・hook) を入れ直すのは、この repo が変わった時だけ:

```
claude plugin marketplace update nolang
claude plugin uninstall nolang@nolang
claude plugin install nolang@nolang
```

入れ直したら Claude Code を起動し直す。ログインは残る。Codex: `codex plugin marketplace upgrade nolang` → `codex plugin remove nolang@nolang` → `codex plugin add nolang@nolang` → 起動し直す。

## 構成

```
nolang-plugin/
  packages/cli/                        # CLI @no-lang/cli = 起動係 (Node 20+・依存なし)。本体は NoLang の server が配る (この repo には無い)
  packages/pypi-nolang/                # PyPI `nolang` = npx で @no-lang/cli を起動するだけの起動係 (名前の確保)
  packages/pypi-nolang-mcp-stdio/      # PyPI `nolang-mcp-stdio` = 名前の確保。NoLang のつなぎ方だけを返す MCP サーバー
  skills/make-video/                   # スキルの正本 (CLI で作る。connector だけの client 向けの MCP の手順も持つ)。文書の写しは持たない
  agents/                              # `nolang make --engine host` の役を受ける subagent (Claude Code だけ)
  hooks/                               # Claude Code の hook: nolang の出力の tell_user (動画・ログインの URL) を通知で画面に出す
  plugins/nolang/                      # 箱 (plugin)。cli/・skills/・agents/・hooks/ は npm run build が正本から作る — 直接直さない
    .claude-plugin/plugin.json         #   Claude Code 用
    .codex-plugin/plugin.json          #   Codex 用 (hooks は書かない)
  .claude-plugin/marketplace.json      # Claude Code 用の棚 (marketplace nolang・plugin は nolang 1 本)
  .agents/plugins/marketplace.json     # Codex 用の棚
  scripts/build-plugins.mjs            # 正本 → plugins/nolang (--check はずれの検査)
  .github/workflows/ci.yml             # npm run check と npm pack --dry-run
  LICENSE                              # Apache-2.0
```

## CLI

```
nolang auth login [--device | --browser] [--background] [--language <ja|en|…>] | login --no-browser | wait | complete '<URL>' | status | logout | env
nolang doctor                         接続先・ログイン・動画を作れるか (残高) を確かめる
nolang account [--language <ja|en|…>]   ユーザーの言語・plan・残高・無料の動画生成の有無・尺 1 分あたりの credit・今作れるか (何も消費しない)。--language でユーザーの言語を変える
nolang make <dir> --genre <explain|film> --request-text "<依頼文>" [--aspect 16:9|9:16] [--seconds 秒|auto (既定 auto)] [--language <ja|en|…> (動画の言語を決め打つ時だけ)] [--engine claude|codex|host]
                                      NoLang の studio と同じ段取りで作る (スキルの標準)。再生できたら URL を返す。役や編集可能モードの flag は nolang make --help
nolang generate --request-text "<依頼文>" [--aspect 16:9|9:16] [--seconds 秒] [--video-language <ja|en|…>] [--confirmed] [--idempotency-key 鍵] [--wait]
                                      NoLang の server が台本と画面を書く (web の home と同じ入口・studio なし)。動画の言語は省けば依頼文の言語。stage=unsupported なら blockers を見せ、--confirmed で再送
                                      応答を失って呼び直す時は 1 回目と同じ --idempotency-key を付ける (動画が重ならない)
nolang check [dir] --language <ja|en|…>   dir の design.txt / timeline.txt を検査 (start 済みの dir では --language を付けない)
nolang start [dir] --title "…" --language <ja|en|…> [--seconds 秒|auto]   cut ごとに流す: 開始だけ (dir に stream.json)
nolang submit [dir] [--end]           書き足した cut を投入 (最後は --end・投入の間は 600 秒以内)
nolang create [dir] --title "…" --language <ja|en|…> [--seconds 秒|auto] [--aspect 16:9|9:16] [--wait] [--dry-run]   全 cut を一度に (人が手で使う時)
nolang stills <dir> [cut]             nolang start の後: まだ投入していない cut を本物の絵の静止画にする
nolang pull <dir> <video_id か URL>   テンプレか自分の動画の保存済みの原稿を dir の reference/ に書く (design.txt・timeline.txt・brief.md)
nolang transcribe <音声か動画の file か id>… [--speakers N]   持ち込み音声を文字起こしして発話の台帳を返す (クレジットを消費する)
nolang edit <dir> <video_id か URL> --request-text "<直す点>"   完成した動画を直す (元の動画はそのまま・言語は元のまま・縦横は依頼に書けば変わる)
nolang status <video_id> [--wait] [--until playable|completed]   completed なら download_url (mp4) と copyright (クレジット表記)
nolang abort <video_id>
nolang reference                      文書一式 (文法・見本・骨組み — server の現行) の dir を返す
nolang assets search <kind> "<説明か名前>" [--mine]   NoLang の素材を探す → ref (id=<uuid> など)
nolang assets upload <file>… [--name 表示名] [--speakers N]   手元の画像 / 動画 / 音声を自分の素材に送る → ref
```

- 結果は stdout に JSON・途中経過は stderr。終了コード 0 成功 / 1 原稿の欠陥・生成の失敗 / 2 使い方 / 3 未ログイン / 4 接続。
- CLI の本体は接続先の server が配る束 (`GET <api>/agent/client/`・tar.gz 1 MB 弱)。`nolang` は起動のたびに手元の束 (`~/.config/nolang/client/<指紋>/`) を `If-None-Match` で照合し (1 往復・届かなければ手元の束で動く)、変わっていれば取り直す。手元に束が無い初めての起動では、届かない・5xx の時に 3 秒・6 秒おいて計 3 回まで取り直す (server の入れ替え中をやり過ごす・最長 約 70 秒)。版番号は無く、指紋 = tar.gz の sha256。flag の表はこの README に持たない — `nolang make --help` が server と同じ版の物を出す。
- 束 (= 実行する code) を取るのは本番 (`api.no-lang.com`) からだけ。本番の束には server の build が Ed25519 で署名していて、起動係は公開鍵 (`packages/cli/nolang.mjs` に焼き込み) で検証してから動かす — 署名の無い束・合わない束は動かさない。`--api` は 1 回だけ書ける。他の NoLang の server (`localhost` の手元のスタックを含む) から取るのは、人が shell に `NOLANG_CLIENT_TRUSTED_ORIGIN=<その URL>` と書いた時だけ (その origin の束は署名が無くても動く)。手元の checkout の CLI を動かすには `NOLANG_CLIENT_DIR` (取得なし)。
- リンクの通知: プラグインの hook (`hooks/`) が、コマンドの出力に `tell_user` (動画・ログインの URL を含む案内) があれば、モデルを通さずに Claude Code の画面に通知として出す (モデルがリンクを書き忘れても届く)。`nolang` がエラーで終わった時 (ログインが要る・クレジットが足りない) にも出す。出すのは、コマンドが `nolang` 1 つだけの時 (`nolang …; 別のコマンド`・パイプ・ファイルの `cat` では出さない) で、案内の中のリンクが全部 `no-lang.com` (か `localhost`) の時だけ — 他の出力は NoLang の通知になりすませない。
- 許可の確認: 動画 1 本を作る間に、小さな操作が数十回起きます (担当が仕事を受け取り、原稿の file を書く、の繰り返し)。プラグインの hook は、この配管だけを確認なしで通します: このプラグイン自身の CLI を 1 つだけ素で打つ `auth status`・`job take`・`wait`・文字と選択だけを渡す `make`、作業ディレクトリの中の原稿の file (`…/stream/jobs/<job>/parts/NNN.txt`) への書き込み、プラグイン自身のスキルの文書の読み込み。手元の file を送れる物 (`assets upload`・`make --speech`)、別の接続先 (`--api`)、ほかのコマンドと繋いだ物、それ以外の file は、これまでどおり Claude Code の許可の確認を通ります。
- 接続先: `--api <URL>` → 環境変数 `NOLANG_API_URL` → 本番 (`https://api.no-lang.com`)。URL だけで、接続先を選んで保存する command は無い (本番以外の NoLang の server は shell の `NOLANG_API_URL` と `NOLANG_CLIENT_TRUSTED_ORIGIN` で向ける)。ログインは接続先ごとに持ち、ログインしても接続先は変わらない。
- ログイン: 手元の機械はエージェントの `--background` も含めてブラウザ認可 (ブラウザが開き、許可するだけ・コード入力なし。始められなければデバイス認可へ自動で切り替え)。SSH・リモートコンテナ・Docker・WSL・画面の無い Linux はデバイス認可を選び、URL とコードをブラウザで入力して許可する (ポート転送不要)。エージェントは `--background` で案内 (デバイス認可ならコードも) を受け取り、`nolang auth wait` で完了を確かめる。`--device` / `--browser` で明示選択できる。ブラウザ認可の戻り先が接続エラーになっても、開始済みのログインに `auth complete '<許可後の URL>'` で貼り戻せる (`--background` も対応)。トークンは `~/.config/nolang/credentials.json` (0600)・期限が切れても自動で更新 (30 日使わなければ再ログイン)。
- CI など非対話: `NOLANG_TOKEN` に access token (`eval "$(nolang auth env)"` が出すもの・1 時間で切れ、CLI は更新しない) を入れる。API key (`nlg-c-…`) は CLI と MCP では使えない (403・NoLang API 用)。
- ログインは MCP と同じ認可サーバー (OAuth 2.1・PKCE・`127.0.0.1` で受ける)。client はログインごとに自動登録 (DCR)。

### studio の実行エンジン

`nolang make ... --engine codex` は、著者・担当・修正役の各呼出しを手元の `codex exec` (配布されたままの Codex CLI の非対話の起動) で実行します。`codex exec` は本文を書き終えてから 1 度で返すので、書いた端から流れる Claude より再生開始が遅くなります。既定の Claude のモデル・effort・プロンプトは変わりません。

Codex は元の `CODEX_HOME` (既定 `~/.codex`) の `auth.json` のみを共有し、ユーザーの設定・hook・plugin・MCP・会話履歴を読み込まない一時環境で動きます。モデルはその Codex CLI の既定を使います。API key の環境変数だけの認証や keyring だけの認証は現在対象外です。呼出しごとの記録 (役・effort・所要・token) は `stream/run.jsonl`、エラーは `stream/codex_*.err` に残ります。

Codex では、手元の CLI とその認証が使える場合は、subagent が使えても `--engine codex` を優先します。生成開始前に CLI またはその認証が使えないと分かった場合、shell と subagent が使えれば `--engine host` に切り替えます。

`nolang make ... --engine host` は LLM の CLI を起動せず、呼び出した session の subagent が原稿を書きます。Claude Code では `claude` コマンドが使えない時に使います。役の起動方法と並列数の調整はスキルの `host-engine.md` が持ちます。この代替経路には Codex 用の agent 定義や設定追加は不要です。

CLI / MCP の原稿検査・素材・描画は共通の NoLang サーバーを使います。著者・担当・修正は手元の LLM (CLI または host session の subagent) が書くので、シェルのないリモート MCP クライアントは `nolang_create_video` (server が書く) か、原稿を自分で書いて投入する手順を使います。

## 開発

直すのは正本 (`packages/cli/`・`skills/`・`agents/`・`hooks/`) だけ。直したら:

```
npm run build       # 正本 → plugins/nolang/ (cli/・skills/・agents/・hooks/ を作り直し、manifest の version を起動係に揃える)
npm run check       # plugins/ が正本どおりか + 起動係と hook のテスト (CI と同じ)
npm run validate    # claude plugin validate --strict (Claude Code が要る)
```

- 版番号 (`packages/cli/package.json`) は起動係の物。build が 2 つの `plugin.json` に写す。CLI 本体に版は無い (束の指紋 — `nolang --version`)。
- **`plugins/nolang/` に入る物を変えたら、必ず版番号を上げる** (`packages/cli/package.json` を上げて `npm run build`)。Claude Code と Codex は版の文字列を比べるので、上げないと `claude plugin update` が「最新です」と答え、利用者の手元は古いままになる。
- CLI 本体はこの repo に無い。NoLang の backend (非公開の repo) で開発し、server が配る。CLI 本体の不具合は、この repo の issue に書いてください。
- 反映: Claude Code はこの repo を直接読むので、次のセッション開始か `/reload-plugins`。Codex は入れた時に `~/.codex/plugins/cache/` へ写すので、入れ直す (`codex plugin remove nolang@nolang` → `codex plugin add nolang@nolang`)。

置き方の決まり (Claude Code と Codex の両方で動かすため):
- 箱は棚の下の sub directory に置く。棚と同じ directory (`./`) に箱を置くと、Claude Code は読むが Codex は棚ごと無視する。
- MCP の接続設定 (`mcpServers`・`.mcp.json`) を棚にも箱にも置かない。プラグインを入れる client はシェルを持つので CLI を使う — 同じ client に MCP も載せると、作る道とログインが二重になる。
- CLI (起動係) とスキルの実体は箱の中に置く (symlink にしない)。Codex は箱ごと cache に写すので、スキルからの相対パス (`../../cli/nolang.mjs`) がどちらでも同じになる。スキルは Claude Code では `${CLAUDE_PLUGIN_ROOT}/cli/nolang.mjs`、`CLAUDE_PLUGIN_ROOT` の無い Codex ではこの相対パスを絶対 path にして呼ぶ。

### 文書と studio (NoLang の server が正本・写しは持たない)

文法の文書一式と CLI 本体 (`nolang make` / `nolang edit` の runner を含む) は NoLang の backend で管理している。`make` / `edit` の段取り (check・担当の割り振り・直し・投入) は server が回し、runner は server が頼む LLM の call を
手元の CLI で実行するだけ — 束に python の script は無い。server は CLI 本体と文書を 1 つの束にして `GET agent/client/` で配り、起動係が起動のたびに取る — この repo には写しも
同期の workflow も無い。スキルも文書の写しを持たない — 自分で
書く経路は `nolang reference` (束の中の文書の dir) か MCP の `nolang_draft_reference` で server の現行を読む。

`SKILL.md` (studio で作る標準の手順・ログイン・素材) と `write-yourself.md` (自分で書く経路) はこの repo で書いた物。文法は server の
`spec.md` を読ませ、`nolang make` の flag は `--help` を読ませる (手順の文書に写さない — 束の外で古びる)。

## 配布

- **license**: Apache-2.0 (`LICENSE`)。
- **npm**: `@no-lang/cli` (コマンド名は `nolang`)。npm の `nolang` (スコープ無し) は NoLang と無関係の別パッケージなので使わない。
- **PyPI**: [`nolang`](https://pypi.org/project/nolang/) と [`nolang-mcp-stdio`](https://pypi.org/project/nolang-mcp-stdio/)。`nolang` は `npx` で `@no-lang/cli` を起動するだけ、`nolang-mcp-stdio` は名前の確保だけ (動画の tool を持たない MCP サーバーで、NoLang のつなぎ方だけを返す)。
- **GitHub**: `mvrks-inc/nolang-plugin`。`claude plugin install nolang --marketplace mvrks-inc/nolang-plugin` (か `/plugin marketplace add mvrks-inc/nolang-plugin`) で入る。

## 今後

- OpenAI の plugin directory・Anthropic の connector directory への申請 (公開後)。
