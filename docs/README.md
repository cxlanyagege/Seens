# Seens Documentation

This directory is the canonical home for Seens product and engineering
documentation. Documents are grouped by responsibility so that product goals,
system design, component behavior, and development procedures can evolve
independently.

## Product

- [Product overview](product/overview.md) explains the audience, product
  capabilities, and privacy principles.
- [Roadmap](product/roadmap.md) records delivery phases and current progress.

## Architecture

- [Architecture overview](architecture/overview.md) defines system boundaries,
  dependency direction, technology choices, and the analysis workflow.

## Components

- [Desktop application](components/desktop-application.md) describes the React
  and Tauri application and its native responsibilities.
- [Analyzer service](components/analyzer-service.md) describes the Python model
  pipeline and command protocol.
- [Shared contracts](components/shared-contracts.md) describes the versioned
  schemas exchanged across the process boundary.

## Development

- [Local development](development/local-development.md) covers environment
  setup, model preparation, application startup, and verification.
- [Database migrations](development/database-migrations.md) defines the SQLite
  schema migration workflow and release constraints.

## Documentation conventions

- Keep detailed documentation under `docs/`; keep the repository `README.md`
  focused on orientation and navigation.
- Add new documents to this index in the section that owns their subject.
- Prefer one clear responsibility per document and link to related documents
  instead of duplicating their content.
- Write documentation and code comments in professional English.
- Use repository-relative links and verify them whenever files move.
