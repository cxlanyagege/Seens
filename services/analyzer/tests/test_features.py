import numpy as np

from seenstruments_analyzer.pipelines.features import HOP_SIZE, MEL_BANDS, PATCH_SIZE, log_mel_spectrogram, make_patches


def test_short_audio_produces_one_complete_patch() -> None:
    audio = np.zeros(8000, dtype=np.float32)
    features = log_mel_spectrogram(audio)
    patches, timestamps = make_patches(features)
    assert patches.shape == (1, PATCH_SIZE, MEL_BANDS)
    assert timestamps.shape == (1,)
    assert np.isfinite(patches).all()


def test_frame_count_matches_centered_full_track_analysis() -> None:
    audio = np.zeros(HOP_SIZE * 10, dtype=np.float32)
    features = log_mel_spectrogram(audio)
    assert features.shape == (10, MEL_BANDS)
