# Analysis Service

This directory contains the experimental local Python analyzer responsible for music analysis.

```text
src/seenstruments_analyzer/
  cli.py        One-shot JSON command protocol
  pipelines/    Feature extraction, inference, and post-processing
  domain/       Shared analysis entities and result types
  infrastructure/
                Model runtimes, audio loading, and persistence adapters
tests/          Unit and integration tests
```

Large model weights and generated analysis artifacts must not be committed to the repository.

## Instrument analysis prototype

The first pipeline decodes a complete track to mono 16 kHz audio with FFmpeg,
uses ONNX Runtime with Discogs-EffNet embeddings and the MTG-Jamendo instrument
classification head, then smooths window predictions into activity segments.
Set up and verify it with:

```sh
uv sync --extra dev --python 3.12
.venv/bin/python scripts/fetch_models.py
.venv/bin/python -m pytest
.venv/bin/seens-analyzer analyze --audio /path/to/track.mp3 --model-dir models/instrument-v1
```

The model directory is intentionally ignored by Git. The committed manifest
records the expected model files and their official download locations.

The current CLI loads the models for every invocation and does not provide
progress or cancellation. Those capabilities belong in the later persistent
sidecar and job protocol. Raw classifier scores are intentionally not described
as calibrated confidence values.
