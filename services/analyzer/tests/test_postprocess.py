import numpy as np

from seenstruments_analyzer.pipelines.postprocess import build_segments


def test_hysteresis_merges_short_gaps_and_drops_short_events() -> None:
    timestamps = np.arange(10, dtype=np.float32)
    grouped = {
        "Piano": np.array([0.0, 0.4, 0.6, 0.5, 0.1, 0.5, 0.6, 0.5, 0.0, 0.4], dtype=np.float32),
        "Bass": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6], dtype=np.float32),
    }
    summaries, segments = build_segments(grouped, timestamps, 10.0, minimum_duration_seconds=1.6)
    assert [summary.instrument for summary in summaries] == ["Piano"]
    assert len(segments) == 1
    assert segments[0].instrument == "Piano"
    assert segments[0].end_seconds - segments[0].start_seconds >= 6.0


def test_edge_segments_cover_the_track_boundaries() -> None:
    timestamps = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    grouped = {"Piano": np.array([0.8, 0.8, 0.8], dtype=np.float32)}
    _, segments = build_segments(grouped, timestamps, 4.0, minimum_duration_seconds=0.0)
    assert segments[0].start_seconds == 0.0
    assert segments[0].end_seconds == 4.0
