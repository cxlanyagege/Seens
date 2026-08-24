# Shared Contracts

The `packages/contracts` component contains versioned JSON Schemas and examples
shared by the desktop application and analysis sidecar. Keeping the process
boundary language-neutral prevents TypeScript, Rust, and Python models from
drifting apart.

`packages/contracts/instrument-analysis.schema.json` defines the current
instrument summary and time-aligned segment result. The Python process emits
this shape, Rust deserializes and caches it, and the TypeScript client consumes
its camel-case fields.

Planned contracts include explicit analysis requests, progress events,
structured errors, stems, and note events.

Contract changes must remain versioned and should be validated in each consumer
before release. See the [architecture overview](../architecture/overview.md) for
the process boundary and dependency direction.
