# まちのAI放送局 (Machi AI Hōsō)

Turns what a town council decided into a short, animated news video that residents actually watch.

Small towns in Japan publish council bills, voting results and monthly newsletters online, but they run to hundreds of pages and almost nobody reads them. Many of these towns no longer have a local newspaper or TV station. This project reads those public documents with Claude, picks the decisions that change residents' lives, and renders each one as a 1–3 minute vertical video with pixel-art characters, animated numbers and a source citation under every sentence.

> Built during [Built with Claude: Japan 2026](https://cerebralvalley.ai/e/built-with-claude-japan2026) (2026-11-02 – 2026-11-08). All code in this repository was written during the event.

## Status

Prototype. One hand-written sample episode (fictional data) renders end to end.

## Run

Requirements: Node.js 20+, Python 3.11+ with `edge-tts`.

```bash
npm install
npm run sfx      # synthesize sound effects and BGM into public/audio/
npm run tts      # narration audio + word timings into public/audio/
npm run render   # out/episode.mp4
```

`npm run studio` opens the Remotion preview.

## How it works

1. `episodes/*.json` describes an episode: scenes, spoken lines, on-screen telop text, emphasis words and the source document.
2. `scripts/tts.py` synthesizes each line and records word timings.
3. `src/timeline.ts` derives scene lengths from the audio, so the episode JSON never contains timestamps.
4. Remotion renders the scenes (`src/Scenes.tsx`) with pixel-art characters whose mouths follow the narration volume.

## Credits

- Video rendering: [Remotion](https://www.remotion.dev/) (free for individuals under the Remotion License)
- Fonts: DotGothic16, Noto Sans JP (SIL Open Font License) via Google Fonts
- Sound effects and BGM: synthesized from code in `scripts/synth_audio.py`
- Prototype narration: Microsoft neural voice ja-JP-NanamiNeural via `edge-tts` (to be replaced by Azure Speech before release)

## License

Source code: MIT. See [LICENSE](LICENSE).
