from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np


def decode_mono(audio_path: Path, sample_rate: int) -> np.ndarray:
    if not audio_path.is_file():
        raise FileNotFoundError(f"Audio file does not exist: {audio_path}")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to decode audio for analysis")

    command = [
        ffmpeg,
        "-v", "error",
        "-i", str(audio_path),
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", "1",
        "-ar", str(sample_rate),
        "pipe:1",
    ]
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(message or "ffmpeg could not decode the audio file")
    audio = np.frombuffer(result.stdout, dtype="<f4").copy()
    if audio.size == 0:
        raise RuntimeError("The decoded audio stream is empty")
    return audio
