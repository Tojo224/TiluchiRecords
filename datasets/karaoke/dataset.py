"""Manifest rules for future karaoke and lyric-alignment data."""

from pathlib import Path
from typing import Any

from datasets.records import validate_common

REQUIRED_ASSETS = {
    "source_video",
    "source_audio",
    "vocals_audio",
    "instrumental_audio",
    "lyrics_json",
}


def validate_record(record: dict[str, Any], dataset_dir: Path) -> list[str]:
    errors = validate_common(record, dataset_dir)
    assets = record.get("assets", {})
    if isinstance(assets, dict):
        missing = REQUIRED_ASSETS - assets.keys()
        if missing:
            errors.append(f"assets missing: {', '.join(sorted(missing))}")
    annotations = record.get("annotations", {})
    if isinstance(annotations, dict) and not annotations.get("language"):
        errors.append("annotations.language is required")
    return errors
