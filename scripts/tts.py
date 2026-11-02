"""Generate narration audio for every line in an episode and write a timing manifest.

Prototype backend: edge-tts (same ja-JP neural voices as Azure TTS).
Output: public/episode.json (the episode to render), public/audio/<line_id>.mp3
and public/audio/manifest.json

Usage: python scripts/tts.py [episodes/sample-kyushokuhi.json]
"""

import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "audio"

# edge-tts streams "audio-24khz-48kbitrate-mono-mp3", a constant bitrate,
# so the byte count gives the duration without decoding.
MP3_BITRATE = 48_000
TICKS_PER_SECOND = 10_000_000

VOICES = {
    "anchor": {"voice": "ja-JP-NanamiNeural", "rate": "+8%", "pitch": "+0Hz"},
    "kid": {"voice": "ja-JP-NanamiNeural", "rate": "+12%", "pitch": "+70Hz"},
}


async def synthesize(line: dict) -> dict:
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
    path = OUT_DIR / f"{line['id']}.mp3"
    path.write_bytes(audio)
    return {
        "id": line["id"],
        "file": f"audio/{path.name}",
        "duration": len(audio) * 8 / MP3_BITRATE,
        "words": words,
    }


async def main(episode_path: Path) -> None:
    episode = json.loads(episode_path.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.mp3"):
        old.unlink()
    (ROOT / "public" / "episode.json").write_text(
        json.dumps(episode, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [line for scene in episode["scenes"] for line in scene["lines"]]
    results = await asyncio.gather(*(synthesize(line) for line in lines))
    manifest = {r["id"]: r for r in results}
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    for r in results:
        print(f"{r['id']}: {r['duration']:.2f}s, {len(r['words'])} words")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "episodes" / "sample-kyushokuhi.json"
    asyncio.run(main(target))
