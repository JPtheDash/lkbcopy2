"""
Generates the looping background music as a seamless OGG.

Synthesised rather than downloaded so it carries no licence or attribution
requirements, same as the sound effects. Replace it freely - drop a real
track at src/assets/audio/music.ogg and the game picks it up unchanged.
See asset-prompts.txt for a prompt to commission a proper one.

    python3 tools/generate_music.py

Requires ffmpeg for the OGG encode (a raw WAV loop is ~1MB, the OGG ~100KB).
"""

import math
import os
import struct
import subprocess
import wave

RATE = 22050
BPM = 84
BEAT = 60.0 / BPM
BARS = 8
BEATS_PER_BAR = 4

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src", "assets", "audio"
)

TOTAL_BEATS = BARS * BEATS_PER_BAR
TOTAL = int(TOTAL_BEATS * BEAT * RATE)


def note(semitones, octave=0):
    """Frequency relative to A4, in equal temperament."""
    return 440.0 * (2 ** ((semitones + 12 * octave) / 12.0))


def add(buf, start, samples, gain=1.0):
    for i, s in enumerate(samples):
        # Wrap so anything hanging over the end folds into the loop start,
        # which is what makes the seam inaudible
        buf[(start + i) % TOTAL] += s * gain


def flute(freq, dur, vol=0.5):
    """Breathy sine lead with a soft attack and a little vibrato."""
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        vib = 1.0 + 0.006 * math.sin(2 * math.pi * 5.2 * t)
        env = min(1.0, t / 0.06) * min(1.0, max(0.0, (dur - t) / 0.18))
        s = (
            math.sin(2 * math.pi * freq * vib * t)
            + 0.18 * math.sin(4 * math.pi * freq * vib * t)
            + 0.05 * math.sin(6 * math.pi * freq * vib * t)
        )
        out.append(s * env * vol)
    return out


def pluck(freq, dur, vol=0.4):
    """Short tanpura-ish pluck."""
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        env = math.exp(-t * 4.5)
        s = math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(4 * math.pi * freq * t)
        out.append(s * env * vol)
    return out


def pad(freq, dur, vol=0.10):
    """
    Soft breathing chord tone.

    The earlier version sustained a root plus a fifth for the whole loop; the
    two partials beat against each other and the result sounded like a horror
    drone. This is one clean partial per note, fading in and out so nothing
    sustains long enough to beat.
    """
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / 0.6) * min(1.0, max(0.0, (dur - t) / 0.8))
        out.append(math.sin(2 * math.pi * freq * t) * env * vol)
    return out


def tabla(dur, low, vol=0.35):
    """Simple membrane hit - pitched thump for bass, tighter click for treble."""
    n = int(dur * RATE)
    out = []
    f = 95.0 if low else 320.0
    for i in range(n):
        t = i / RATE
        env = math.exp(-t * (18 if low else 34))
        pitch = f * (1.0 + (2.5 if low else 1.2) * math.exp(-t * 30))
        out.append(math.sin(2 * math.pi * pitch * t) * env * vol)
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    buf = [0.0] * TOTAL

    # Raga-flavoured scale (roughly Bhoopali): D E F# A B
    scale = [note(-7), note(-5), note(-3), note(0), note(2), note(5), note(7)]

    # Warm chord pads, one per bar, each fading in and out. Nothing sustains
    # across the whole loop, so there is no beating and no drone.
    chords = [0, 0, 5, 5, 7, 7, 0, 0]

    for bar, root in enumerate(chords):
        at = int(bar * BEATS_PER_BAR * BEAT * RATE)
        length = BEATS_PER_BAR * BEAT * 0.98
        add(buf, at, pad(note(root - 24), length, 0.13))
        add(buf, at, pad(note(root - 12), length, 0.07))

    # Flute melody, one phrase per two bars
    phrase = [
        (0, 4, 1.5), (1.5, 3, 0.5), (2, 4, 1.0), (3, 2, 1.0),
        (4, 1, 1.5), (5.5, 2, 0.5), (6, 0, 2.0),
        (8, 4, 1.0), (9, 5, 1.0), (10, 6, 1.5), (11.5, 5, 0.5),
        (12, 4, 1.0), (13, 2, 1.0), (14, 3, 2.0),
    ]

    for start_beat, degree, length in phrase:
        for rep in range(2):
            at = int((start_beat + rep * 16) * BEAT * RATE)
            add(buf, at, flute(scale[degree], length * BEAT * 0.95, 0.26))

    # Plucked arpeggio on the offbeats
    for b in range(TOTAL_BEATS):
        if b % 2 == 1:
            deg = [0, 2, 4, 2][(b // 2) % 4]
            add(buf, int(b * BEAT * RATE), pluck(scale[deg] / 2, BEAT * 0.9, 0.22))

    # Tabla: low on 1 and 3, tight on the and-of-2
    for bar in range(BARS):
        base = bar * BEATS_PER_BAR
        add(buf, int((base + 0) * BEAT * RATE), tabla(0.35, True, 0.22))
        add(buf, int((base + 1.5) * BEAT * RATE), tabla(0.18, False, 0.13))
        add(buf, int((base + 2) * BEAT * RATE), tabla(0.30, True, 0.18))
        add(buf, int((base + 3.5) * BEAT * RATE), tabla(0.18, False, 0.11))

    peak = max(abs(s) for s in buf) or 1.0
    scale_to = 0.70 / peak

    wav_path = os.path.join(OUT_DIR, "_music_tmp.wav")

    with wave.open(wav_path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s * scale_to)) * 32767))
            for s in buf
        ))

    ogg_path = os.path.join(OUT_DIR, "music.ogg")

    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
         "-c:a", "libvorbis", "-qscale:a", "3", ogg_path],
        check=True
    )

    os.remove(wav_path)

    print(f"wrote music.ogg  {TOTAL_BEATS * BEAT:.1f}s  "
          f"{os.path.getsize(ogg_path)/1024:.0f}KB")


if __name__ == "__main__":
    main()
