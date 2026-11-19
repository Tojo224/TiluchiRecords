"""Validate JSONL manifests for future datasets; does not train or run inference."""

from __future__ import annotations

import importlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASETS = ("karaoke", "face_swap", "music_video")


def main() -> int:
    total_errors = 0
    found_manifests = 0
    for dataset_name in DATASETS:
        dataset_dir = ROOT / dataset_name
        manifest = dataset_dir / "manifest.jsonl"
        if not manifest.exists():
            print(f"{dataset_name}: no manifest.jsonl yet; schema is ready")
            continue

        found_manifests += 1
        validator = importlib.import_module(f"datasets.{dataset_name}.dataset")
        for line_number, line in enumerate(
            manifest.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                print(f"{dataset_name}:{line_number}: invalid JSON: {error.msg}")
                total_errors += 1
                continue
            if not isinstance(record, dict):
                print(f"{dataset_name}:{line_number}: each record must be an object")
                total_errors += 1
                continue
            errors = validator.validate_record(record, dataset_dir)
            for error in errors:
                print(f"{dataset_name}:{line_number}: {error}")
                total_errors += 1
            if not errors:
                print(f"{dataset_name}:{line_number}: valid metadata")

    if not found_manifests:
        print("No manifests found. No records were evaluated.")
    return 1 if total_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
