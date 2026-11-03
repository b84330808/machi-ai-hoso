"""Synthesize license-free sound effects and an 8-bit BGM loop with the standard library.

Output: public/audio/sfx_*.wav and public/audio/bgm.wav (44.1 kHz, 16-bit, mono)

Usage: python -I scripts/synth_audio.py
"""

import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "audio"
RATE = 44_100


def write_wav(name: str, samples: list[float]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = 0.9 / peak if peak > 0.9 else 1.0
    with wave.open(str(OUT_DIR / name), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(struct.pack("<h", int(s * scale * 32767)) for s in samples))


def envelope(i: int, n: int, attack: float = 0.005, curve: float = 4.0) -> float:
    t = i / RATE
    a = min(1.0, t / attack) if attack > 0 else 1.0
    return a * (1 - i / n) ** curve


def pop() -> list[float]:
    n = int(RATE * 0.12)
    out, phase = [], 0.0
    for i in range(n):
        freq = 900 - 600 * (i / n)
        phase += 2 * math.pi * freq / RATE
        out.append(math.sin(phase) * envelope(i, n, 0.002, 3))
    return out


def ding() -> list[float]:
    n = int(RATE * 0.7)
    return [
        (math.sin(2 * math.pi * 1318.5 * i / RATE) + 0.5 * math.sin(2 * math.pi * 1975.5 * i / RATE))
        * envelope(i, n, 0.003, 3)
        * 0.6
        for i in range(n)
    ]


def tap() -> list[float]:
    """Scene changes and cards sliding in: a short rounded tap (sine with a quick pitch drop)."""
    n = int(RATE * 0.09)
    out, phase = [], 0.0
    for i in range(n):
        x = i / n
        freq = 1150 - 450 * x
        phase += 2 * math.pi * freq / RATE
        env = min(1.0, i / (0.002 * RATE)) * (1 - x) ** 4
        out.append(math.sin(phase) * env * 0.9)
    return out


def stamp() -> list[float]:
    rng = random.Random(3)
    n = int(RATE * 0.3)
    out, phase = [], 0.0
    for i in range(n):
        freq = 140 - 90 * (i / n)
        phase += 2 * math.pi * freq / RATE
        thump = math.sin(phase) * envelope(i, n, 0.001, 5)
        noise = rng.uniform(-1, 1) * envelope(i, n, 0.0, 12) * 0.5
        out.append(thump + noise)
    return out


def note_freq(midi: int) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def bgm() -> list[float]:
    """8 bars at 132 BPM: I-V-vi-IV in C with square lead, triangle bass and noise hats."""
    bpm = 132
    step = 60 / bpm / 2  # eighth notes
    chords = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [57, 60, 64]), (41, [57, 60, 65])]
    lead_pattern = [0, 2, 1, 2, 0, 1, 2, 1]
    total_steps = 8 * 8
    n = int(total_steps * step * RATE)
    out = [0.0] * n
    rng = random.Random(11)

    def add_tone(start: float, dur: float, freq: float, kind: str, vol: float) -> None:
        s0, length = int(start * RATE), int(dur * RATE)
        for i in range(length):
            if s0 + i >= n:
                break
            t = i / RATE
            x = (freq * t) % 1.0
            if kind == "square":
                v = 1.0 if x < 0.25 else -1.0
            else:
                v = 4 * abs(x - 0.5) - 1
            env = min(1.0, i / (0.004 * RATE)) * max(0.0, 1 - i / length) ** 0.6
            out[s0 + i] += v * env * vol

    for s in range(total_steps):
        bar = s // 8
        bass_root, triad = chords[bar % 4]
        start = s * step
        if s % 2 == 0:
            add_tone(start, step * 1.8, note_freq(bass_root - 12 + (7 if s % 4 == 2 else 0)), "triangle", 0.35)
        lead = triad[lead_pattern[s % 8]] + (12 if bar % 2 else 0)
        add_tone(start, step * 0.85, note_freq(lead), "square", 0.10)
        hat_len = int(0.03 * RATE)
        for i in range(hat_len):
            idx = int(start * RATE) + i
            if idx < n:
                out[idx] += rng.uniform(-1, 1) * (1 - i / hat_len) * (0.12 if s % 2 else 0.06)
    return out


if __name__ == "__main__":
    write_wav("sfx_pop.wav", pop())
    write_wav("sfx_ding.wav", ding())
    write_wav("sfx_tap.wav", tap())
    write_wav("sfx_stamp.wav", stamp())
    write_wav("bgm.wav", bgm())
    print("wrote sfx_pop, sfx_ding, sfx_tap, sfx_stamp, bgm to", OUT_DIR)
