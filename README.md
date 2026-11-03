# まちのAI放送局

日本語 | [English](README.en.md)

町が決めたことを、住民が最後まで見られる短いアニメニュースにします。

小さな町の暮らしを変える決定（議案、料金の改定案、募集のお知らせなど）は、町のサイトにPDFで公開されていますが、ほとんど読まれていません。このプロジェクトは、その公開資料を Claude が読み、住民への影響がいちばん大きい話題を選んで、1分ほどの縦型動画にします。ピクセルアートのキャラクターと動く数字で伝え、すべてのセリフに元資料のページを付けています。

> [Built with Claude: Japan 2026](https://cerebralvalley.ai/e/built-with-claude-japan2026)（2026年11月2日〜8日）の会期中に開発しました。このリポジトリのコードは、すべて会期中に書いたものです。

## すぐに試す（インストール不要）

**https://b84330808.github.io/machi-ai-hoso/** — インストールも API キーも不要です。

1. 「自治体」と「だれ向け」を選ぶと、生成済みのニュースが右のスマホ枠で再生されます。
2. 「完成原稿と出典」のセリフをクリックすると、その場面に移動します。「出典 p.2」のリンクで、町のPDFの該当ページが開きます。
3. 「愛媛県 久万高原町／一般」で「取材の記録を再生」を押すと、このニュースをつくったときの実際の過程（ネタ選び、出典付きの取材メモ、台本の執筆、校閲の赤字と書き直し）を再生します。待ち時間は短縮しています。

新しいニュースをつくるには、下の手順でローカル版を動かしてください。

## 現状

プロトタイプです。サイト全体がオープンデータとして公開されている4自治体で、8本のニュースを生成しています。ローカル版のアプリで生成から動画までのすべてを実行でき、オンライン版ではその結果を再生できます。

## ローカルで動かす

必要なもの：Node.js 22 以上、Python 3.11 以上と `edge-tts`（`pip install edge-tts`）、ニュースを生成する場合は `.env` に Anthropic の API キー（`ANTHROPIC_API_KEY=...`）。

```bash
npm install
npm run sfx      # 効果音と BGM を public/audio/ に生成
npm run app      # http://localhost:5173
```

1. 「自治体」と「だれ向け」を選び、「取材をはじめる」を押します。
2. 左側に編集部の作業が表示されます。デスクがネタを影響の大きい順に並べ、記者が原文のページ付きで事実を書き出し、構成作家が原稿用紙に台本を書き、校閲が赤字を入れて書き直させ、最後にナレーターが収録します。
3. 完成した動画が右側で再生されます。「完成原稿と出典」でセリフをクリックするとその場面へ、「出典」で元のPDFの該当ページへ移動します。「MP4 に書き出す」で動画ファイルを保存できます。

API キーがなくても、`episodes/` にある生成済みのニュースは再生できます（初回再生時に音声を収録します）。

### 再生専用版（サーバー・API キー不要）

```bash
npm run build:static   # dist/ に静的サイトを出力（GitHub Pages などに置けます）
```

同じ画面で、事前に用意したデータを読み込みます。音声付きのニュースをすべて再生でき、「取材の記録を再生」では、そのニュースをつくったときに記録した編集部の過程（`episodes/<id>.log.json`：進行の各イベントと時刻）を再生します。新しいニュースはつくれません。

## コマンドで使う

```bash
npm run fetch -- kumakogen                    # 町の公開資料を sources/ にダウンロード
npm run generate -- kumakogen                 # Claude 編集部 → episodes/kumakogen-<日付>-general.json
npm run tts -- episodes/<episode-id>.json     # 音声と単語ごとのタイミングを public/episodes/<episode-id>/ に
npm run render -- <episode-id>                # out/<episode-id>.mp4
```

`generate` には `--audience parents|seniors|easy`（子育て世帯・シニア・やさしい日本語）と `--reuse-facts`（その町の前回の取材メモから台本だけを書き直す）を指定できます。`npm run tts -- episodes/sample-kyushokuhi.json` のあと `npm run render -- sample-kyushokuhi` で、手書きのサンプル（架空のデータ）を動画にできます。`npm run studio` で Remotion のプレビューが開きます。

## しくみ

1. **編集部**（`scripts/newsroom.ts`、Claude Opus 5.5）
   - **デスク**：町のPDFを読み、住民の暮らしへの影響が大きい順に話題を並べます（構造化出力）。
   - **記者**：選んだ話題について、ページ単位の出典付きで事実を取り出します（Citations API）。
   - **構成作家**：事実だけを使い、動画の設計図（`src/schema.ts`）の形で台本を書きます（構造化出力）。ストリーミングで、書いている途中のセリフも画面に出します。アナウンサーのセリフには、根拠にした事実の ID を必ず付けます。
   - **校閲**：画面と音声に出る数字がすべて出典の事実に含まれるか、セリフやテロップが長すぎないかをコードで確認し、校閲役の Claude が正確さ・中立性・「案」と「決定」の区別を確かめます。指摘は構成作家に戻して最大2回書き直させ、残った指摘はニュースと一緒に記録します。

   各工程は進行イベント（`scripts/events.ts`）を出し、`server/index.ts` が Server-Sent Events で画面に送ります。
2. `scripts/tts.py` がセリフごとに音声を合成し、単語ごとのタイミングを記録します。
3. `src/timeline.ts` が音声の長さから場面の長さを決めるので、台本の JSON に時刻を書く必要はありません。
4. Remotion が場面を描画します（`src/Scenes.tsx`）：3種類のレイアウトと6種類のアニメーション部品、声に合わせて口が動くピクセルアートのキャラクター、各セリフの出典表示。

## デモ動画

提出したデモ動画は、このアプリを実際に操作した録画からつくっています（モックではありません）。`demo/record.mjs` が起動中のアプリを headless Chrome で操作して画面を録画し、クリック位置と編集部の各工程が表示された時刻を記録します。`demo/narrate.py` が `demo/narration.json` のナレーションを合成し、`Demo` コンポジション（`src/demo/`）がナレーションに合わせて録画を編集し、待ち時間を早送りし、スマホ枠の中にニュースを音声付きで重ねます。

```bash
NO_HMR=1 npm run app      # 別のターミナルで。NO_HMR で録画中のページ再読み込みを防ぎます
npm run demo:record       # Google Chrome が必要。"make" の録画では実際に編集部を動かします（API キー）
npm run demo:narrate
npm run demo:render       # out/demo.mp4
```

## データの出典

使用した公開資料は `cities/` の設定ファイルにあります。どの自治体もサイト全体を出典表示付きで再利用・加工できる条件で公開しており、動画には出典と加工した旨を表示しています。ダウンロードした資料はリポジトリに含めていません。

| 自治体 | 利用条件 |
| --- | --- |
| 愛媛県久万高原町 | 公共データ利用規約（PDL1.0） |
| 三重県菰野町 | 公共データ利用規約（PDL1.0） |
| 北海道森町 | 公共データ利用規約（PDL1.0）。写真・画像は対象外のため使用していません |
| 北海道室蘭市 | CC BY 4.0 |

## クレジット

- 動画の描画：[Remotion](https://www.remotion.dev/)（Remotion License により個人は無料）
- フォント：DotGothic16、Noto Sans JP、BIZ UDGothic、BIZ UDPGothic、BIZ UDPMincho、Klee One（SIL Open Font License、Google Fonts 経由）
- Web プレーヤー：[Remotion Player](https://www.remotion.dev/player)、開発サーバー：[Vite](https://vite.dev/)
- 効果音・BGM：`scripts/synth_audio.py` のコードで合成
- ナレーション：Microsoft のニューラル音声 ja-JP-NanamiNeural（ニュース）と ja-JP-KeitaNeural（デモ動画）を [`edge-tts`](https://github.com/rany2/edge-tts) で合成。生成した音声は、このリポジトリのライセンスの対象外です。

## ライセンス

ソースコード：MIT。[LICENSE](LICENSE) を参照してください。
