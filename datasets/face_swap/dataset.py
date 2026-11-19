"""Manifest rules for future, consented face-swap research/evaluation data."""

from pathlib import Path
from typing import Any

from datasets.records import validate_common

REQUIRED_ASSETS = {"source_face_image", "target_video", "face_annotations_json"}


def validate_record(record: dict[str, Any], dataset_dir: Path) -> list[str]:
    errors = validate_common(record, dataset_dir)
    assets = record.get("assets", {})
    if isinstance(assets, dict):
        missing = REQUIRED_ASSETS - assets.keys()
        if missing:
            errors.append(f"assets missing: {', '.join(sorted(missing))}")
    source = record.get("source", {})
    if (
        isinstance(source, dict)
        and record.get("record_type") == "real"
        and source.get("consent_status") != "granted"
    ):
        errors.append("face-swap records require explicit consent_status=granted")
    if (
        isinstance(source, dict)
        and record.get("record_type") == "real"
        and not source.get("consent_reference")
    ):
        errors.append("face-swap records require a consent_reference")
    annotations = record.get("annotations", {})
    if isinstance(annotations, dict) and not isinstance(
        annotations.get("target_person_ids"), list
    ):
        errors.append("annotations.target_person_ids must be a list")
    return errors
