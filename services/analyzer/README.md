# Analysis Service

This directory will contain the local Python sidecar responsible for music analysis.

```text
src/seenstruments_analyzer/
  api/          Sidecar protocol and request handlers
  pipelines/    Instrument, tempo, key, stem, and note pipelines
  domain/       Shared analysis entities and result types
  infrastructure/
                Model runtimes, audio loading, and persistence adapters
tests/          Unit and integration tests
```

Large model weights and generated analysis artifacts must not be committed to the repository.

