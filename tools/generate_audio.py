"""
Generates the game's sound effects as 16-bit mono WAV files.

The sounds are synthesised here rather than downloaded so they carry no
licence or attribution requirements. Re-run after tweaking to regenerate:

    python3 tools/generate_audio.py
"""

import math
import os
import random
import struct
import wave

RATE = 22050
OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src", "assets", "audio"
)


def envelope(i, total, attack=0.01, release=0.35):
    """Short attack, exponential decay."""
    t = i / RATE
    dur = total / RATE

    if t < attack:
        return t / attack

    remaining = (dur - t) / max(dur - attack, 1e-6)
    return max(0.0, remaining) ** 0.6 * math.exp(-t / release)


def tone(freq_start, freq_end, dur, vol=0.5, harmonics=(1.0, 0.35, 0.12)):
    """Sine with a couple of harmonics, gliding between two pitches."""
    total = int(dur * RATE)
    out = []
    phase = 0.0

    for i in range(total):
        f = freq_start + (freq_end - freq_start) * (i / total)
        phase += 2 * math.pi * f / RATE

        s = sum(a * math.sin(phase * n) for n, a in enumerate(harmonics, 1))
        out.append(s * vol * envelope(i, total))

    return out


def noise(dur, vol=0.5, lowpass=0.25):
    """Filtered noise burst, used for thuds."""
    total = int(dur * RATE)
    out = []
    prev = 0.0

    for i in range(total):
        n = random.uniform(-1, 1)
        prev += (n - prev) * lowpass
        out.append(prev * vol * envelope(i, total, release=0.08))

    return out


def sequence(notes, gap=0.0):
    """Play notes one after another. Each note is a sample list."""
    out = []

    for n in notes:
        out.extend(n)
        out.extend([0.0] * int(gap * RATE))

    return out


def mix(*layers):
    length = max(len(l) for l in layers)
    out = [0.0] * length

    for layer in layers:
        for i, s in enumerate(layer):
            out[i] += s

    return out


def write(name, samples):
    path = os.path.join(OUT_DIR, name)

    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)

        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767))
            for s in samples
        )

        f.writeframes(frames)

    print("wrote", name, len(samples) / RATE, "s")


# Equal temperament helper
def note(n):
    return 440.0 * (2 ** (n / 12.0))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    random.seed(7)

    # Jump - quick upward whoop
    write("jump.wav", tone(320, 720, 0.18, 0.45))

    # Land - soft thud with a low body
    write("land.wav", mix(
        noise(0.12, 0.35),
        tone(150, 90, 0.12, 0.3, (1.0, 0.2))
    ))

    # Collect butter - bright rising arpeggio
    write("collect.wav", sequence([
        tone(note(4), note(4), 0.09, 0.4),
        tone(note(9), note(9), 0.09, 0.4),
        tone(note(12), note(12), 0.09, 0.4),
        tone(note(16), note(16), 0.22, 0.45),
    ]))

    # Star - clean ding
    write("star.wav", tone(note(19), note(19), 0.38, 0.4, (1.0, 0.5, 0.25, 0.1)))

    # Level complete - short fanfare
    write("win.wav", sequence([
        tone(note(0), note(0), 0.13, 0.4),
        tone(note(4), note(4), 0.13, 0.4),
        tone(note(7), note(7), 0.13, 0.4),
        tone(note(12), note(12), 0.45, 0.5),
    ]))

    # Time up - descending sigh
    write("lose.wav", sequence([
        tone(note(0), note(-2), 0.18, 0.4),
        tone(note(-3), note(-5), 0.18, 0.4),
        tone(note(-7), note(-12), 0.5, 0.45),
    ]))

    # UI tap
    write("click.wav", tone(900, 620, 0.07, 0.32, (1.0, 0.3)))


if __name__ == "__main__":
    main()
