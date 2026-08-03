# Shared Contracts

Versioned JSON Schemas and examples shared by the desktop application and the analysis sidecar belong here. Keeping the process boundary language-neutral prevents TypeScript, Rust, and Python models from drifting apart.

`instrument-analysis.schema.json` defines the current instrument summary and time-aligned segment result. The Python process emits this shape, Rust deserializes and caches it, and the TypeScript client consumes the camelCase fields.

Planned contracts include explicit analysis requests, progress events, structured errors, stems, and note events.
