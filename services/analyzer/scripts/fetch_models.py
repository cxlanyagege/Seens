from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Download the instrument analysis models.")
    parser.add_argument("--output", type=Path, default=Path(__file__).parents[1] / "models" / "instrument-v1")
    args = parser.parse_args()

    manifest_path = Path(__file__).parents[1] / "models" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)

    for entry in manifest["files"]:
        destination = args.output / entry["name"]
        if destination.exists() and destination.stat().st_size == entry["size"]:
            print(f"Using {destination.name}")
            continue
        print(f"Downloading {destination.name}")
        temporary = destination.with_suffix(destination.suffix + ".part")
        urllib.request.urlretrieve(entry["url"], temporary)
        if temporary.stat().st_size != entry["size"]:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"Unexpected size for {destination.name}")
        temporary.replace(destination)


if __name__ == "__main__":
    main()
