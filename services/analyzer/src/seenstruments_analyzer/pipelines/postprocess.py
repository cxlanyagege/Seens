from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np

from seenstruments_analyzer.domain import InstrumentSegment, InstrumentSummary

DEFAULT_GROUPS: dict[str, tuple[str, ...]] = {
    "Voice": ("voice",),
    "Drums": ("drums", "beat", "drummachine"),
    "Percussion": ("percussion", "bongo", "bell"),
    "Bass": ("bass", "acousticbassguitar", "doublebass"),
    "Guitar": ("guitar", "acousticguitar", "electricguitar", "classicalguitar"),
    "Piano": ("piano", "electricpiano", "rhodes"),
    "Keys": ("keyboard", "organ", "pipeorgan", "accordion"),
    "Strings": ("strings", "violin", "viola", "cello", "harp"),
    "Brass": ("brass", "trumpet", "trombone", "horn"),
    "Woodwinds": ("flute", "clarinet", "oboe", "saxophone", "harmonica"),
    "Synthesizer": ("synthesizer", "pad"),
    "Electronic": ("computer", "sampler"),
    "Orchestra": ("orchestra",),
}


def _median_filter(values: np.ndarray, width: int = 3) -> np.ndarray:
    if values.size < 2 or width <= 1:
        return values.copy()
    radius = width // 2
    padded = np.pad(values, (radius, radius), mode="edge")
    windows = np.lib.stride_tricks.sliding_window_view(padded, width)
    return np.median(windows, axis=1)


def group_predictions(predictions: np.ndarray, labels: Sequence[str], groups: Mapping[str, Sequence[str]] = DEFAULT_GROUPS) -> dict[str, np.ndarray]:
    label_indexes = {label: index for index, label in enumerate(labels)}
    grouped: dict[str, np.ndarray] = {}
    for group, members in groups.items():
        indexes = [label_indexes[member] for member in members if member in label_indexes]
        if indexes:
            grouped[group] = predictions[:, indexes].max(axis=1)
    return grouped


def build_segments(
    grouped: Mapping[str, np.ndarray],
    timestamps: np.ndarray,
    duration_seconds: float,
    enter_threshold: float = 0.35,
    exit_threshold: float = 0.20,
    merge_gap_seconds: float = 1.5,
    minimum_duration_seconds: float = 1.5,
) -> tuple[list[InstrumentSummary], list[InstrumentSegment]]:
    if timestamps.size == 0:
        return [], []
    interval = float(np.median(np.diff(timestamps))) if timestamps.size > 1 else 1.0
    segments: list[InstrumentSegment] = []

    for instrument, raw_values in grouped.items():
        values = _median_filter(np.asarray(raw_values, dtype=np.float32))
        candidates: list[tuple[int, int]] = []
        start: int | None = None
        for index, value in enumerate(values):
            if start is None and value >= enter_threshold:
                start = index
            elif start is not None and value < exit_threshold:
                candidates.append((start, index))
                start = None
        if start is not None:
            candidates.append((start, values.size))

        merged: list[tuple[int, int]] = []
        for candidate in candidates:
            if merged and (candidate[0] - merged[-1][1]) * interval <= merge_gap_seconds:
                merged[-1] = (merged[-1][0], candidate[1])
            else:
                merged.append(candidate)

        for start_index, end_index in merged:
            start_seconds = 0.0 if start_index == 0 else max(0.0, float(timestamps[start_index] - interval / 2))
            end_seconds = duration_seconds if end_index >= timestamps.size else min(duration_seconds, float(timestamps[end_index - 1] + interval / 2))
            if end_seconds - start_seconds < minimum_duration_seconds:
                continue
            active = values[start_index:end_index]
            segments.append(InstrumentSegment(
                instrument=instrument,
                start_seconds=round(start_seconds, 3),
                end_seconds=round(end_seconds, 3),
                confidence=round(float(np.percentile(active, 90)), 4),
                peak_confidence=round(float(active.max()), 4),
            ))

    segments.sort(key=lambda item: (item.start_seconds, item.instrument))
    summaries: list[InstrumentSummary] = []
    for instrument in grouped:
        instrument_segments = [segment for segment in segments if segment.instrument == instrument]
        if not instrument_segments:
            continue
        summaries.append(InstrumentSummary(
            instrument=instrument,
            confidence=max(segment.confidence for segment in instrument_segments),
            active_seconds=round(sum(segment.end_seconds - segment.start_seconds for segment in instrument_segments), 3),
        ))
    summaries.sort(key=lambda item: (-item.confidence, -item.active_seconds, item.instrument))
    return summaries, segments
