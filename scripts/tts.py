"""Generate narration audio for every line in an episode and write a timing manifest.

Prototype backend: edge-tts (same ja-JP neural voices as Azure TTS).
Output, for episodes/<episode_id>.json: public/episodes/<episode_id>/episode.json,
<line_id>.mp3 for every line, and manifest.json with durations and word timings.

Usage: python scripts/tts.py [episodes/sample-kyushokuhi.json]
"""

import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent

# edge-tts streams "audio-24khz-48kbitrate-mono-mp3", a constant bitrate,
# so the byte count gives the duration without decoding.
MP3_BITRATE = 48_000
TICKS_PER_SECOND = 10_000_000

VOICES = {
    "anchor": {"voice": "ja-JP-NanamiNeural", "rate": "+8%", "pitch": "+0Hz"},
    "kid": {"voice": "ja-JP-NanamiNeural", "rate": "+12%", "pitch": "+70Hz"},
    # Narrator of the submission video (demo/narrate.py), distinct from the in-episode cast.
    "narrator": {"voice": "ja-JP-KeitaNeural", "rate": "+6%", "pitch": "+0Hz"},
}


# A few parallel connections are fast enough; opening one per line at once can fail DNS lookups on Windows.
PARALLEL = 4
RETRIES = 4


async def stream_line(line: dict) -> tuple[bytearray, list[dict]]:
    params = VOICES[line["speaker"]]
    communicate = edge_tts.Communicate(
        line.get("yomi", line["text"]),
        params["voice"],
        rate=params["rate"],
        pitch=params["pitch"],
        boundary="WordBoundary",
    )
    audio = bytearray()
    words = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            words.append(
                {
                    "text": chunk["text"],
                    "start": chunk["offset"] / TICKS_PER_SECOND,
                    "end": (chunk["offset"] + chunk["duration"]) / TICKS_PER_SECOND,
                }
            )
    return audio, words


async def synthesize(line: dict, out_dir: Path, slots: asyncio.Semaphore) -> dict:
    async with slots:
        for attempt in range(1, RETRIES + 1):
            try:
                audio, words = await stream_line(line)
                break
            except Exception as err:  # network errors from aiohttp / edge-tts
                if attempt == RETRIES:
                    raise RuntimeError(f"{line['id']}: narration failed after {RETRIES} tries ({err})") from err
                await asyncio.sleep(attempt * 1.5)
    path = out_dir / f"{line['id']}.mp3"
    path.write_bytes(audio)
    result = {
        "id": line["id"],
        "file": path.relative_to(ROOT / "public").as_posix(),
        "duration": len(audio) * 8 / MP3_BITRATE,
        "words": words,
    }
    # One line per finished narration; the web app counts these for its progress meter.
    print(f"{result['id']}: {result['duration']:.2f}s, {len(words)} words", flush=True)
    return result


async def main(episode_path: Path) -> None:
    episode = json.loads(episode_path.read_text(encoding="utf-8"))
    out_dir = ROOT / "public" / "episodes" / episode_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.mp3"):
        old.unlink()
    (out_dir / "manifest.json").unlink(missing_ok=True)
    (out_dir / "episode.json").write_text(
        json.dumps(episode, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [line for scene in episode["scenes"] for line in scene["lines"]]
    slots = asyncio.Semaphore(PARALLEL)
    results = await asyncio.gather(*(synthesize(line, out_dir, slots) for line in lines))
    manifest = {r["id"]: r for r in results}
    # Written last: its presence means the episode is ready to play.
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "episodes" / "sample-kyushokuhi.json"
    asyncio.run(main(target))
