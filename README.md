# Seens

**See what you hear.**

Seens (codename Seenstruments) is a local-first desktop music player that helps
listeners explore the instruments inside a song. It combines familiar playback
controls with instrument detection and a time-aligned activity timeline, with
stem exploration planned for later phases.

> [!NOTE]
> Seens currently has a functional local-player prototype and an experimental
> instrument-analysis path. Instrument scores and timeline thresholds are not
> yet calibrated against a product-quality validation set.

## Quick start

Prepare the analyzer and launch the native desktop application:

```sh
cd services/analyzer
uv sync --extra dev --python 3.12
.venv/bin/python scripts/fetch_models.py

cd ../../apps/desktop
npm install
npm run tauri:dev
```

`npm run dev` provides a browser-only UI preview. File access, playback, and
instrument inference require the Tauri application.

See the [local development guide](docs/development/local-development.md) for
setup details, verification commands, and component-specific workflows.

## Documentation

The [documentation index](docs/README.md) is the canonical entry point for all
project documentation.

| Area | Document |
| --- | --- |
| Product scope | [Product overview](docs/product/overview.md) |
| Delivery plan | [Roadmap](docs/product/roadmap.md) |
| System design | [Architecture overview](docs/architecture/overview.md) |
| Components | [Component documentation](docs/README.md#components) |
| Development | [Local development](docs/development/local-development.md) |

## Repository layout

```text
apps/desktop/          Tauri desktop application and React interface
services/analyzer/     Local Python music-analysis sidecar
packages/contracts/    Versioned schemas shared across languages
docs/                  Product and engineering documentation
scripts/               Development and packaging utilities
```

## License

See [LICENSE](LICENSE).
