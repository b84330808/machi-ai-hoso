# まちのAI放送局 (Machi AI Hōsō)

[日本語](README.md) | English

Turns what a town decided into a short, animated news video that residents actually watch.

Small towns in Japan publish council bills, fee changes and notices as PDFs on their websites, where few residents read them. This project reads those public documents with Claude, picks the item that changes residents' lives most, and renders it as a vertical video of about a minute, with pixel-art characters, animated numbers and the source page under every sentence.

> Built during [Built with Claude: Japan 2026](https://cerebralvalley.ai/e/built-with-claude-japan2026) (2026-11-02 – 2026-11-08). All code in this repository was written during the event.

## Try it online

**https://b84330808.github.io/machi-ai-hoso/** — no install or API key. Pick a town (自治体) and an audience (だれ向け) to watch the generated episodes; click any line of the script to jump to it, or its 出典 link to open the cited page of the town's PDF. For 愛媛県 久万高原町 / 一般, 取材の記録を再生 replays the newsroom run that made the episode (story ranking, cited facts, the script being written, the checker's corrections and rewrites), with the long waits shortened. To make new episodes, run the app locally (below).

## Status

Prototype. Eight episodes from four towns whose websites are open data. The web app runs the whole pipeline locally; the online version plays its results.

## Run the app

Requirements: Node.js 22+, Python 3.11+ with `edge-tts` (`pip install edge-tts`), and an Anthropic API key in `.env` (`ANTHROPIC_API_KEY=...`) for the newsroom step.

```bash
npm install
npm run sfx      # synthesize sound effects and BGM into public/audio/
npm run app      # http://localhost:5173
```

1. Pick a town (自治体) and an audience (だれ向け), then press 取材をはじめる.
2. The left side shows the newsroom at work: the desk ranks story ideas, the reporter extracts facts with page citations, the writer drafts the script on manuscript paper, the checker marks problems in red and the writer revises, then the narrator records.
3. The finished video plays on the right. Under 完成原稿と出典, click a line to jump to it, or its 出典 link to open that page of the original PDF. MP4 に書き出す renders a file you can download.

Without an API key the app still plays episodes that already exist in `episodes/` (it records the narration on first play).

### Playback build (no server, no API key)

```bash
npm run build:static   # dist/: a static site for GitHub Pages or any static host
```

The same interface, reading pre-built data. It plays every voiced episode, and 取材の記録を再生 replays a newsroom run recorded while that episode was made (`episodes/<id>.log.json`: every progress event with its time; long waits are shortened). It cannot make new episodes.

## Command line

```bash
npm run fetch -- kumakogen                    # download the town's public documents into sources/
npm run generate -- kumakogen                 # Claude newsroom → episodes/kumakogen-<date>-general.json
npm run tts -- episodes/<episode-id>.json     # narration + word timings into public/episodes/<episode-id>/
npm run render -- <episode-id>                # out/<episode-id>.mp4
```

`generate` also takes `--audience parents|seniors|easy` and `--reuse-facts` (rewrite the script from the last facts for that town). `npm run tts -- episodes/sample-kyushokuhi.json` then `npm run render -- sample-kyushokuhi` renders the hand-written sample. `npm run studio` opens the Remotion preview.

## How it works

1. **Newsroom** (`scripts/newsroom.ts`, Claude Opus 5.5):
   - *Desk* reads the town's PDFs and ranks items by how much they change residents' lives (structured output).
   - *Reporter* extracts the facts for the chosen item with page-level citations (Citations API).
   - *Writer* turns the facts into an episode in the renderer's schema (`src/schema.ts`, structured output), streamed so the lines appear as they are written. Every anchor line lists the fact IDs it relies on.
   - *Checks*: code verifies every number on screen comes from a cited fact and that lines and telops fit; a *checker* agent reviews accuracy, neutrality and proposal-vs-decided wording. Problems go back to the writer, up to two rewrites; anything left is saved with the episode.
   Every step reports progress events (`scripts/events.ts`); `server/index.ts` streams them to the web UI over Server-Sent Events.
2. `scripts/tts.py` synthesizes each line and records word timings.
3. `src/timeline.ts` derives scene lengths from the audio, so the episode JSON never contains timestamps.
4. Remotion renders the scenes (`src/Scenes.tsx`): three layouts and six animated visuals, pixel-art characters whose mouths follow the narration, and the source page under every line.

## Demo video

The submission video was made from recordings of this app, not a mock-up. `demo/record.mjs` drives the running app in headless Chrome and saves screencasts plus a log of clicks and of when each newsroom step appeared; `demo/narrate.py` voices `demo/narration.json`; the `Demo` composition (`src/demo/`) cuts the recordings to the narration, speeds up the waiting, and draws the episodes over the phone frame with their sound.

```bash
NO_HMR=1 npm run app      # in another terminal; NO_HMR keeps the page from reloading mid-recording
npm run demo:record       # needs Google Chrome; the "make" clip runs the real newsroom (API key)
npm run demo:narrate
npm run demo:render       # out/demo.mp4
```

## Data sources

City configs in `cities/` list the public documents used. Each town publishes its whole website for reuse with attribution; videos credit the source and note that it was edited. Downloaded documents are not committed.

| Town | Terms |
| --- | --- |
| 愛媛県久万高原町 | 公共データ利用規約（PDL1.0） |
| 三重県菰野町 | 公共データ利用規約（PDL1.0） |
| 北海道森町 | 公共データ利用規約（PDL1.0）; photos and images excluded, so none are used |
| 北海道室蘭市 | CC BY 4.0 |

## Credits

- Video rendering: [Remotion](https://www.remotion.dev/) (free for individuals under the Remotion License)
- Fonts: DotGothic16, Noto Sans JP, BIZ UDGothic, BIZ UDPGothic, BIZ UDPMincho, Klee One (SIL Open Font License) via Google Fonts
- Web player: [Remotion Player](https://www.remotion.dev/player); dev server: [Vite](https://vite.dev/)
- Sound effects and BGM: synthesized from code in `scripts/synth_audio.py`
- Narration: Microsoft neural voices ja-JP-NanamiNeural (episodes) and ja-JP-KeitaNeural (demo video) via [`edge-tts`](https://github.com/rany2/edge-tts). Generated audio is not covered by this repository's license.

## License

Source code: MIT. See [LICENSE](LICENSE).
