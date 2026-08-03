from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from seenstruments_analyzer.domain import InstrumentAnalysis
from seenstruments_analyzer.infrastructure import decode_mono
from seenstruments_analyzer.pipelines.features import HOP_SIZE, PATCH_HOP, SAMPLE_RATE, log_mel_spectrogram, make_patches
from seenstruments_analyzer.pipelines.postprocess import build_segments, group_predictions

MODEL_ID = "discogs-effnet-mtg-jamendo-instrument"
MODEL_VERSION = "1"
EMBEDDING_MODEL = "discogs-effnet-bsdynamic-1.onnx"
CLASSIFIER_MODEL = "mtg_jamendo_instrument-discogs-effnet-1.onnx"


class InstrumentPipeline:
    def __init__(self, model_dir: Path, batch_size: int = 64) -> None:
        try:
            import onnxruntime as ort
        except ImportError as error:
            raise RuntimeError("onnxruntime is not installed") from error

        embedding_path = model_dir / EMBEDDING_MODEL
        classifier_path = model_dir / CLASSIFIER_MODEL
        missing = [path.name for path in (embedding_path, classifier_path) if not path.is_file()]
        if missing:
            raise RuntimeError(f"Missing instrument model files: {', '.join(missing)}")

        self.batch_size = max(1, batch_size)
        self.embedding_session = ort.InferenceSession(str(embedding_path), providers=["CPUExecutionProvider"])
        self.classifier_session = ort.InferenceSession(str(classifier_path), providers=["CPUExecutionProvider"])
        self.embedding_input = self.embedding_session.get_inputs()[0].name
        self.embedding_output = next(output.name for output in self.embedding_session.get_outputs() if output.shape[-1] == 1280)
        self.classifier_input = self.classifier_session.get_inputs()[0].name
        self.classifier_output = next(output.name for output in self.classifier_session.get_outputs() if output.shape[-1] == 40)
        metadata_path = model_dir / "mtg_jamendo_instrument-discogs-effnet-1.json"
        if metadata_path.is_file():
            self.labels = json.loads(metadata_path.read_text(encoding="utf-8"))["classes"]
        else:
            self.labels = _default_labels()

    def analyze(self, audio_path: Path) -> InstrumentAnalysis:
        audio = decode_mono(audio_path, SAMPLE_RATE)
        duration_seconds = audio.size / SAMPLE_RATE
        features = log_mel_spectrogram(audio)
        patches, timestamps = make_patches(features)

        predictions: list[np.ndarray] = []
        for start in range(0, patches.shape[0], self.batch_size):
            batch = patches[start:start + self.batch_size]
            embeddings = self.embedding_session.run([self.embedding_output], {self.embedding_input: batch})[0]
            output = self.classifier_session.run([self.classifier_output], {self.classifier_input: embeddings})[0]
            predictions.append(np.asarray(output, dtype=np.float32))
        probabilities = np.concatenate(predictions, axis=0)
        summaries, segments = build_segments(group_predictions(probabilities, self.labels), timestamps, duration_seconds)
        return InstrumentAnalysis(
            model_id=MODEL_ID,
            model_version=MODEL_VERSION,
            duration_seconds=round(duration_seconds, 3),
            prediction_interval_seconds=round(PATCH_HOP * HOP_SIZE / SAMPLE_RATE, 3),
            instruments=summaries,
            segments=segments,
        )


def _default_labels() -> list[str]:
    return [
        "accordion", "acousticbassguitar", "acousticguitar", "bass", "beat", "bell", "bongo", "brass",
        "cello", "clarinet", "classicalguitar", "computer", "doublebass", "drummachine", "drums",
        "electricguitar", "electricpiano", "flute", "guitar", "harmonica", "harp", "horn", "keyboard",
        "oboe", "orchestra", "organ", "pad", "percussion", "piano", "pipeorgan", "rhodes", "sampler",
        "saxophone", "strings", "synthesizer", "trombone", "trumpet", "viola", "violin", "voice",
    ]
