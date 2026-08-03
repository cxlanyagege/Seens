from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class InstrumentSegment:
    instrument: str
    start_seconds: float
    end_seconds: float
    confidence: float
    peak_confidence: float


@dataclass(frozen=True)
class InstrumentSummary:
    instrument: str
    confidence: float
    active_seconds: float


@dataclass(frozen=True)
class InstrumentAnalysis:
    model_id: str
    model_version: str
    duration_seconds: float
    prediction_interval_seconds: float
    instruments: list[InstrumentSummary]
    segments: list[InstrumentSegment]

    def to_dict(self) -> dict[str, object]:
        return {
            "modelId": self.model_id,
            "modelVersion": self.model_version,
            "durationSeconds": self.duration_seconds,
            "predictionIntervalSeconds": self.prediction_interval_seconds,
            "instruments": [
                {"instrument": item.instrument, "confidence": item.confidence, "activeSeconds": item.active_seconds}
                for item in self.instruments
            ],
            "segments": [
                {
                    "instrument": item.instrument,
                    "startSeconds": item.start_seconds,
                    "endSeconds": item.end_seconds,
                    "confidence": item.confidence,
                    "peakConfidence": item.peak_confidence,
                }
                for item in self.segments
            ],
        }
