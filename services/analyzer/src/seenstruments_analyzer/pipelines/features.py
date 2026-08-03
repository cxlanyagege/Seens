from __future__ import annotations

import numpy as np

SAMPLE_RATE = 16000
FFT_SIZE = 512
HOP_SIZE = 256
MEL_BANDS = 96
PATCH_SIZE = 128
PATCH_HOP = 62


def _hz_to_slaney_mel(frequencies: np.ndarray) -> np.ndarray:
    frequencies = np.asarray(frequencies, dtype=np.float64)
    frequencies = np.maximum(frequencies, 0.0)
    linear_spacing = 200.0 / 3.0
    log_start_hz = 1000.0
    log_start_mel = log_start_hz / linear_spacing
    log_step = np.log(6.4) / 27.0
    return np.where(
        frequencies < log_start_hz,
        frequencies / linear_spacing,
        log_start_mel + np.log(np.maximum(frequencies, log_start_hz) / log_start_hz) / log_step,
    )


def _slaney_mel_to_hz(mels: np.ndarray) -> np.ndarray:
    mels = np.asarray(mels, dtype=np.float64)
    linear_spacing = 200.0 / 3.0
    log_start_hz = 1000.0
    log_start_mel = log_start_hz / linear_spacing
    log_step = np.log(6.4) / 27.0
    return np.where(
        mels < log_start_mel,
        mels * linear_spacing,
        log_start_hz * np.exp(log_step * (mels - log_start_mel)),
    )


def mel_filterbank() -> np.ndarray:
    mel_edges = np.linspace(_hz_to_slaney_mel(np.array([0.0]))[0], _hz_to_slaney_mel(np.array([SAMPLE_RATE / 2]))[0], MEL_BANDS + 2)
    hz_edges = _slaney_mel_to_hz(mel_edges)
    frequencies = np.linspace(0.0, SAMPLE_RATE / 2, FFT_SIZE // 2 + 1)
    filters = np.zeros((MEL_BANDS, frequencies.size), dtype=np.float32)
    for index in range(MEL_BANDS):
        left, center, right = hz_edges[index:index + 3]
        filters[index] = np.maximum(0.0, np.minimum(
            (frequencies - left) / max(center - left, 1e-12),
            (right - frequencies) / max(right - center, 1e-12),
        ))
        filters[index] *= 2.0 / max(right - left, 1e-12)
    return filters


def log_mel_spectrogram(audio: np.ndarray) -> np.ndarray:
    if audio.ndim != 1:
        raise ValueError("Expected mono audio")
    if audio.size < FFT_SIZE:
        audio = np.pad(audio, (0, FFT_SIZE - audio.size))
    audio = audio.astype(np.float32, copy=False)
    frame_count = max(1, 1 + int(np.ceil((audio.size - FFT_SIZE / 2) / HOP_SIZE)))
    right_padding = max(0, (frame_count - 1) * HOP_SIZE + FFT_SIZE - (audio.size + FFT_SIZE // 2))
    padded = np.pad(audio, (FFT_SIZE // 2, right_padding))
    frames = np.lib.stride_tricks.sliding_window_view(padded, FFT_SIZE)[::HOP_SIZE][:frame_count]
    window = np.hanning(FFT_SIZE + 1)[:-1].astype(np.float32)
    spectrum = np.abs(np.fft.rfft(frames * window, n=FFT_SIZE, axis=1)) ** 2
    mel = spectrum @ mel_filterbank().T
    return np.log10(1.0 + 10000.0 * np.maximum(mel, 0.0)).astype(np.float32)


def make_patches(features: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if features.ndim != 2 or features.shape[1] != MEL_BANDS:
        raise ValueError(f"Expected features shaped [time, {MEL_BANDS}]")
    if features.shape[0] < PATCH_SIZE:
        features = np.pad(features, ((0, PATCH_SIZE - features.shape[0]), (0, 0)), mode="edge")

    starts = list(range(0, max(1, features.shape[0] - PATCH_SIZE + 1), PATCH_HOP))
    final_start = max(0, features.shape[0] - PATCH_SIZE)
    if starts[-1] != final_start:
        starts.append(final_start)
    patches = np.stack([features[start:start + PATCH_SIZE] for start in starts]).astype(np.float32)
    centers = (np.asarray(starts, dtype=np.float32) + PATCH_SIZE / 2) * HOP_SIZE / SAMPLE_RATE
    return patches, centers
