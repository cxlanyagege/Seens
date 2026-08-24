# Analyzer Service

The experimental local Python analyzer in `services/analyzer` owns music
analysis pipelines and exposes a one-shot JSON command protocol to the desktop
application.

## Structure

```text
services/analyzer/
  src/seenstruments_analyzer/
    cli.py             One-shot JSON command protocol
    pipelines/         Feature extraction, inference, and post-processing
    domain/            Shared analysis entities and result types
    infrastructure/    Model runtimes and audio-loading adapters
  tests/               Unit and integration tests
```

## Instrument analysis prototype

The first pipeline decodes a complete track to mono 16 kHz audio with FFmpeg,
uses ONNX Runtime with Discogs-EffNet embeddings and the MTG-Jamendo instrument
classification head, then smooths window predictions into activity segments.

The model directory is intentionally ignored by Git. The committed manifest
records the expected model files and their official download locations. Large
model weights and generated analysis artifacts must not be committed to the
repository.

The current command loads the models for every invocation and does not provide
progress or cancellation. Those capabilities belong in a future persistent
sidecar and job protocol. Raw classifier scores are intentionally not described
as calibrated confidence values.

See [local development](../development/local-development.md) for model setup,
command examples, and test instructions. The emitted result format is described
by the [shared contracts](shared-contracts.md).
