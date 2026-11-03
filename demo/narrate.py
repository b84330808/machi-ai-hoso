"""Narration for the submission video: demo/narration.json → public/demo/narration/<id>.mp3 and manifest.json.

Uses the same synthesis as the episodes (scripts/tts.py) with the "narrator" voice.

Usage: python demo/narrate.py
"""

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from tts import PARALLEL, synthesize  # noqa: E402

OUT_DIR = ROOT / "public" / "demo" / "narration"


async def main() -> None:
    lines = json.loads((ROOT / "demo" / "narration.json").read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    slots = asyncio.Semaphore(PARALLEL)
    results = await asyncio.gather(*(synthesize({**line, "speaker": "narrator"}, OUT_DIR, slots) for line in lines))
    texts = {line["id"]: line["text"] for line in lines}
    manifest = {r["id"]: {**r, "text": texts[r["id"]]} for r in results}
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
