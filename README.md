# まちのAI放送局 (Machi AI Hōsō)

Turns what a town council decided into a short, animated news video that residents actually watch.

Small towns in Japan publish council bills, voting results and monthly newsletters online, but they run to hundreds of pages and almost nobody reads them. Many of these towns no longer have a local newspaper or TV station. This project reads those public documents with Claude, picks the decisions that change residents' lives, and renders each one as a 1–3 minute vertical video with pixel-art characters, animated numbers and a source citation under every sentence.

> Built during [Built with Claude: Japan 2026](https://cerebralvalley.ai/e/built-with-claude-japan2026) (2026-11-02 – 2026-11-08). All code in this repository was written during the event.

## Status

Prototype. The web app runs the whole pipeline locally; one hand-written sample episode (fictional data) renders end to end without an API key.

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

## Command line

```bash
npm run fetch -- kumakogen                    # download the town's public documents into sources/
npm run generate -- kumakogen                 # Claude newsroom → episodes/kumakogen-<date>-general.json
npm run tts -- episodes/<episode-id>.json     # narration + word timings into public/episodes/<episode-id>/
npm run render -- <episode-id>                # out/<episode-id>.mp4
```

`npm run tts -- episodes/sample-kyushokuhi.json` then `npm run render -- sample-kyushokuhi` renders the hand-written sample. `npm run studio` opens the Remotion preview.

## How it works

1. **Newsroom** (`scripts/generate.ts`, Claude Opus 5.5):
   - *Desk* reads the town's PDFs and ranks items by how much they change residents' lives (structured output).
   - *Facts* extracts the facts for the chosen item with page-level citations (Citations API).
   - *Writer* turns the facts into an episode in the renderer's schema (`src/schema.ts`, structured output). Every anchor line lists the fact IDs it relies on.
   - *Checks*: code verifies every number on screen comes from a cited fact and telop rows fit; a *fact checker* agent reviews accuracy, neutrality and proposal-vs-decided wording. Failures go back to the writer for one revision.
   Every step reports progress events (`scripts/events.ts`); `server/index.ts` streams them to the web UI over Server-Sent Events.
2. `scripts/tts.py` synthesizes each line and records word timings.
3. `src/timeline.ts` derives scene lengths from the audio, so the episode JSON never contains timestamps.
4. Remotion renders the scenes (`src/Scenes.tsx`): three layouts and six animated visuals, pixel-art characters whose mouths follow the narration, and the source page under every line.

## Data sources

City configs in `cities/` list the public documents used. Kumakogen (愛媛県久万高原町) publishes its website content under the 公共データ利用規約 (PDL1.0); videos credit the source and note that it was edited. Downloaded documents are not committed.

## Credits

- Video rendering: [Remotion](https://www.remotion.dev/) (free for individuals under the Remotion License)
- Fonts: DotGothic16, Noto Sans JP, BIZ UDGothic, BIZ UDPGothic, BIZ UDPMincho, Klee One (SIL Open Font License) via Google Fonts
- Web player: [Remotion Player](https://www.remotion.dev/player); dev server: [Vite](https://vite.dev/)
- Sound effects and BGM: synthesized from code in `scripts/synth_audio.py`
- Prototype narration: Microsoft neural voice ja-JP-NanamiNeural via `edge-tts` (to be replaced by Azure Speech before release)

## License

Source code: MIT. See [LICENSE](LICENSE).
