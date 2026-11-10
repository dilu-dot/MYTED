"""Render the original TEDDY piano loop (authoring only: numpy, scipy, ffmpeg).

Uses Alexander Holm's Salamander Grand Piano samples, CC BY 3.0.
The public player uses the rendered MP3; it needs no Python or audio library.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
import math
import subprocess
import tempfile

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'intro/public/music'
RATE, BPM = 32000, 64
BEAT = 60 / BPM
PERIOD = 16 * 4 * BEAT
NOTES = {'A2': 45, 'C3': 48, 'Ds3': 51, 'Fs3': 54, 'A3': 57,
         'C4': 60, 'Ds4': 63, 'Fs4': 66, 'A4': 69, 'C5': 72, 'Ds5': 75}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='teddy-piano-') as temp:
        cache = Path(temp)

        def load(item):
            name, midi = item
            sample = cache / (name + '.mp3')
            sample.write_bytes(urlopen('https://tonejs.github.io/audio/salamander/' + name + '.mp3', timeout=30).read())
            raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(sample), '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-'])
            data = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
            data /= max(.01, np.max(np.abs(data)))
            return midi, data

        with ThreadPoolExecutor(max_workers=4) as pool:
            samples = dict(pool.map(load, NOTES.items()))
        total = round(PERIOD * RATE)
        mix = np.zeros((total, 2), dtype=np.float64)
        rng = np.random.default_rng(24)

        def note(midi, beat, velocity, sustain=2.5):
            source_midi = min(samples, key=lambda key: abs(key - midi))
            source = samples[source_midi]
            step = 2 ** ((midi - source_midi) / 12)
            length = min(round((sustain * BEAT + 1.1) * RATE), math.floor((len(source) - 1) / step))
            position = np.arange(length) * step
            audio = np.column_stack([np.interp(position, np.arange(len(source)), source[:, channel]) for channel in range(2)])
            # Soften the sampled hammer and let the pedal release naturally.
            envelope = np.minimum(1, np.arange(length) / (RATE * .006))
            release = max(0, length - round(RATE * 1.1))
            envelope[release:] *= np.linspace(1, 0, length - release) ** 1.7
            audio *= (envelope * velocity)[:, None]
            start = round((beat * BEAT + rng.uniform(-.012, .012)) * RATE) % total
            indices = (start + np.arange(length)) % total
            mix[indices] += audio

        # An original, unhurried 16-bar phrase in C: open voicings and a small
        # answering melody. The final suspended chord resolves into the loop.
        chords = [
            (48, [55, 59, 64, 67], [76, 74, 71]),
            (45, [52, 59, 60, 64], [72, 71, 69]),
            (41, [53, 57, 60, 67], [69, 72, 76]),
            (43, [55, 60, 62, 67], [74, 72, 71]),
            (40, [52, 55, 59, 62], [71, 74, 76]),
            (45, [52, 57, 60, 64], [72, 71, 69]),
            (38, [53, 57, 60, 64], [69, 72, 74]),
            (43, [55, 59, 62, 69], [71, 69, 67]),
        ]
        for bar in range(16):
            bass, chord, melody = chords[bar % 8]
            origin = bar * 4
            note(bass, origin, .31, 3.0)
            for index, offset in enumerate([.12, .8, 1.5, 2.15, 2.85, 3.55]):
                note(chord[[0, 1, 2, 3, 2, 1][index]], origin + offset, rng.uniform(.14, .20), 1.45)
            # Leave breathing room at the close of each four-bar phrase.
            for index, offset in enumerate([.5, 1.75, 3.0]):
                if index == 2 and bar % 4 == 3:
                    continue
                note(melody[index], origin + offset, .255 if index == 0 else .22, 1.65)
        mix = sosfilt(butter(2, 5400, fs=RATE, output='sos'), mix, axis=0)
        dry = mix.copy()
        # Circular room tails make the loop boundary continuous.
        for delay, gain in [(.071, .10), (.127, .07), (.233, .055), (.381, .04), (.617, .025), (.913, .015)]:
            mix += np.roll(dry[:, ::-1], round(delay * RATE), axis=0) * gain
        mix *= .67 / max(.01, np.max(np.abs(mix)))
        output = OUTPUT / 'a-little-beginning.mp3'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', '96k', '-metadata', 'title=A Little Beginning',
                        '-metadata', 'artist=Original TEDDY piano arrangement', '-metadata',
                        'comment=Piano samples: Salamander Grand Piano by Alexander Holm, CC BY 3.0. Arranged, pitch-shifted, mixed and rendered for TEDDY.', str(output)],
                       input=mix.astype('<f4').tobytes(), check=True)
        print(f'Original piano loop: {PERIOD:.1f}s, {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
