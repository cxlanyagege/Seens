from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from seenstruments_analyzer.pipelines import InstrumentPipeline


def main() -> None:
    parser = argparse.ArgumentParser(prog="seens-analyzer")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("health")
    analyze = subparsers.add_parser("analyze")
    analyze.add_argument("--audio", type=Path, required=True)
    analyze.add_argument("--model-dir", type=Path, required=True)
    analyze.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    if args.command == "health":
        print(json.dumps({"status": "ok", "protocolVersion": 1}))
        return

    try:
        result = InstrumentPipeline(args.model_dir, args.batch_size).analyze(args.audio)
        print(json.dumps({"ok": True, "result": result.to_dict()}, separators=(",", ":")))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
